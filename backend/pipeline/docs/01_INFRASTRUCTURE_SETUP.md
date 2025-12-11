# Phase 1: Infrastructure Setup (BullMQ + Redis)

[← Back to Index](./REFACTOR_INDEX.md) | [← Previous: Overview](./00_OVERVIEW.md) | [Next: Logging & Observability →](./02_LOGGING_OBSERVABILITY.md)

---

## Overview

**Goal**: Replace database polling scheduler with BullMQ queue system backed by Redis

**Duration**: 1-2 days

**Key Deliverables**:

- Redis installed and configured with persistence
- BullMQ integrated into project
- QueueManager class replacing Scheduler
- Health checks and monitoring
- Job scheduling working end-to-end

---

## Prerequisites

- [ ] Node.js 18+ installed
- [ ] Access to Redis (local Docker or cloud service)
- [ ] Existing scheduler still running (for parallel operation)
- [ ] Backup of database taken

---

## Step 1: Redis Setup

### Option A: Local Development (Docker)

```bash
# Pull Redis image
docker pull redis:latest

# Run with persistence enabled
docker run -d \
  --name mspbyte-redis \
  -p 6379:6379 \
  -v redis-data:/data \
  redis:latest \
  redis-server \
  --appendonly yes \
  --appendfsync everysec

# Test connection
docker exec -it mspbyte-redis redis-cli ping
# Expected output: PONG
```

### Option B: Redis Cloud (Production)

1. Sign up at https://redis.com/try-free/
2. Create new database
3. Note connection details:
   - Host
   - Port
   - Password
4. Configure TLS if required

### Redis Configuration File

Create `redis.conf` for production:

```conf
# Persistence
appendonly yes
appendfsync everysec

# Snapshots
save 900 1
save 300 10
save 60 10000

# Memory
maxmemory 512mb
maxmemory-policy noeviction

# Auto-rewrite AOF
auto-aof-rewrite-percentage 100
auto-aof-rewrite-min-size 64mb

# Logging
loglevel notice
logfile /var/log/redis/redis.log
```

### Verify Persistence

```bash
# Set a test key
redis-cli SET test-key "test-value"

# Restart Redis
docker restart mspbyte-redis

# Check key persists
redis-cli GET test-key
# Expected: "test-value"
```

---

## Step 2: Install Dependencies

```bash
cd backend/pipeline

# Install BullMQ and dependencies
npm install bullmq@5 ioredis@5

# Install types
npm install -D @types/ioredis
```

### Update package.json

```json
{
  "dependencies": {
    "bullmq": "^5.0.0",
    "ioredis": "^5.0.0"
    // ... existing dependencies
  }
}
```

---

## Step 3: Create Redis Connection Manager

**File**: `src/lib/redis.ts`

```typescript
import IORedis from "ioredis";
import Debug from "./debug";

class RedisManager {
  private static connection: IORedis | null = null;
  private static isConnecting = false;

  static async getConnection(): Promise<IORedis> {
    if (this.connection && this.connection.status === "ready") {
      return this.connection;
    }

    if (this.isConnecting) {
      // Wait for existing connection attempt
      await new Promise((resolve) => setTimeout(resolve, 100));
      return this.getConnection();
    }

    this.isConnecting = true;

    try {
      const config = {
        host: process.env.REDIS_HOST || "localhost",
        port: parseInt(process.env.REDIS_PORT || "6379"),
        password: process.env.REDIS_PASSWORD,
        maxRetriesPerRequest: null, // Required for BullMQ
        retryStrategy: (times: number) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
      };

      this.connection = new IORedis(config);

      this.connection.on("connect", () => {
        Debug.log({
          module: "RedisManager",
          context: "connection",
          message: "Connected to Redis",
        });
      });

      this.connection.on("error", (error) => {
        Debug.error({
          module: "RedisManager",
          context: "connection",
          message: `Redis error: ${error.message}`,
          error,
        });
      });

      this.connection.on("close", () => {
        Debug.log({
          module: "RedisManager",
          context: "connection",
          message: "Redis connection closed",
        });
      });

      // Wait for connection
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Redis connection timeout"));
        }, 5000);

        this.connection!.once("ready", () => {
          clearTimeout(timeout);
          resolve();
        });

        this.connection!.once("error", (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });

      this.isConnecting = false;
      return this.connection;
    } catch (error) {
      this.isConnecting = false;
      this.connection = null;
      throw error;
    }
  }

  static async disconnect(): Promise<void> {
    if (this.connection) {
      await this.connection.quit();
      this.connection = null;
    }
  }

  static async ping(): Promise<boolean> {
    try {
      const conn = await this.getConnection();
      const result = await conn.ping();
      return result === "PONG";
    } catch (error) {
      return false;
    }
  }
}

export default RedisManager;
```

### Environment Variables

Add to `.env`:

```bash
# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=  # Leave empty for local dev

# Production example:
# REDIS_HOST=redis-12345.c1.us-east-1-2.ec2.cloud.redislabs.com
# REDIS_PORT=12345
# REDIS_PASSWORD=your-password-here
```

---

## Step 4: Create QueueManager

**File**: `src/queue/QueueManager.ts`

```typescript
import { Queue, Worker, Job, QueueEvents } from "bullmq";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import RedisManager from "../lib/redis";
import Debug from "../lib/debug";
import NatsClient from "../lib/nats";

interface JobData {
  action: string;
  tenantId: Id<"tenants">;
  dataSourceId: Id<"data_sources">;
  metadata?: Record<string, any>;
  syncId?: string;
  cursor?: string;
  batchNumber?: number;
}

interface RecurringJobConfig {
  name: string;
  pattern: string; // Cron pattern
  action: string;
  perTenant: boolean;
  priority?: number;
}

class QueueManager {
  private queue: Queue;
  private worker: Worker;
  private queueEvents: QueueEvents;
  private client: ConvexHttpClient;
  private natsClient: typeof NatsClient;
  private isInitialized = false;

  constructor(client: ConvexHttpClient, natsClient: typeof NatsClient) {
    this.client = client;
    this.natsClient = natsClient;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    const connection = await RedisManager.getConnection();

    // Create queue
    this.queue = new Queue("pipeline-jobs", {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 5000,
        },
        removeOnComplete: {
          age: 86400, // 24 hours
          count: 1000,
        },
        removeOnFail: {
          age: 604800, // 7 days
          count: 5000,
        },
      },
    });

    // Create worker
    this.worker = new Worker(
      "pipeline-jobs",
      async (job: Job<JobData>) => {
        return await this.processJob(job);
      },
      {
        connection,
        concurrency: 10,
      },
    );

    // Queue events for monitoring
    this.queueEvents = new QueueEvents("pipeline-jobs", { connection });

    this.setupEventListeners();
    await this.registerRecurringJobs();

    this.isInitialized = true;

    Debug.log({
      module: "QueueManager",
      context: "initialize",
      message: "QueueManager initialized successfully",
    });
  }

  private setupEventListeners(): void {
    // Worker events
    this.worker.on("completed", (job: Job) => {
      Debug.log({
        module: "QueueManager",
        context: "worker.completed",
        message: `Job ${job.id} completed`,
        metadata: {
          jobName: job.name,
          duration: Date.now() - (job.processedOn || job.timestamp),
        },
      });
    });

    this.worker.on("failed", (job: Job | undefined, error: Error) => {
      Debug.error({
        module: "QueueManager",
        context: "worker.failed",
        message: `Job ${job?.id} failed: ${error.message}`,
        error,
        metadata: {
          jobName: job?.name,
          attempts: job?.attemptsMade,
        },
      });
    });

    this.worker.on("error", (error: Error) => {
      Debug.error({
        module: "QueueManager",
        context: "worker.error",
        message: `Worker error: ${error.message}`,
        error,
      });
    });

    // Queue events
    this.queueEvents.on("waiting", ({ jobId }) => {
      Debug.log({
        module: "QueueManager",
        context: "queue.waiting",
        message: `Job ${jobId} is waiting`,
      });
    });
  }

  private async processJob(job: Job<JobData>): Promise<void> {
    const { action, tenantId, dataSourceId, metadata, syncId } = job.data;

    Debug.log({
      module: "QueueManager",
      context: "processJob",
      message: `Processing job ${job.id}: ${action}`,
      metadata: {
        tenantId,
        dataSourceId,
        syncId,
        attempt: job.attemptsMade + 1,
      },
    });

    // Publish to NATS (existing event flow)
    await this.natsClient.publish(action, {
      tenantId,
      dataSourceId,
      metadata,
      syncId,
      jobId: job.id,
    });

    Debug.log({
      module: "QueueManager",
      context: "processJob",
      message: `Published ${action} to NATS`,
      metadata: { jobId: job.id, syncId },
    });
  }

  async scheduleJob(params: {
    action: string;
    tenantId: Id<"tenants">;
    dataSourceId: Id<"data_sources">;
    priority?: number;
    delay?: number;
    metadata?: Record<string, any>;
    syncId?: string;
    jobId?: string;
  }): Promise<string> {
    const job = await this.queue.add(
      params.action,
      {
        action: params.action,
        tenantId: params.tenantId,
        dataSourceId: params.dataSourceId,
        metadata: params.metadata,
        syncId: params.syncId,
      },
      {
        priority: params.priority,
        delay: params.delay,
        jobId: params.jobId,
      },
    );

    Debug.log({
      module: "QueueManager",
      context: "scheduleJob",
      message: `Scheduled job ${job.id}: ${params.action}`,
      metadata: {
        tenantId: params.tenantId,
        priority: params.priority,
        delay: params.delay,
      },
    });

    return job.id!;
  }

  async scheduleNextBatch(params: {
    action: string;
    tenantId: Id<"tenants">;
    dataSourceId: Id<"data_sources">;
    syncId: string;
    cursor: string;
    batchNumber: number;
    priority: number;
  }): Promise<string> {
    return await this.scheduleJob({
      action: params.action,
      tenantId: params.tenantId,
      dataSourceId: params.dataSourceId,
      priority: params.priority + 10, // Boost priority for in-progress syncs
      metadata: {
        cursor: params.cursor,
        batchNumber: params.batchNumber,
      },
      syncId: params.syncId,
      jobId: `${params.syncId}-batch-${params.batchNumber}`,
    });
  }

  private async registerRecurringJobs(): Promise<void> {
    const recurringJobs: RecurringJobConfig[] = [
      {
        name: "sync-identities",
        pattern: "0 */1 * * *", // Every hour
        action: "microsoft-365.sync.identities",
        perTenant: true,
        priority: 5,
      },
      {
        name: "sync-policies",
        pattern: "0 */1 * * *",
        action: "microsoft-365.sync.policies",
        perTenant: true,
        priority: 5,
      },
      {
        name: "sync-groups",
        pattern: "0 */1 * * *",
        action: "microsoft-365.sync.groups",
        perTenant: true,
        priority: 5,
      },
      {
        name: "sync-roles",
        pattern: "0 */1 * * *",
        action: "microsoft-365.sync.roles",
        perTenant: true,
        priority: 5,
      },
      {
        name: "sync-licenses",
        pattern: "0 */1 * * *",
        action: "microsoft-365.sync.licenses",
        perTenant: true,
        priority: 5,
      },
    ];

    for (const jobConfig of recurringJobs) {
      if (jobConfig.perTenant) {
        await this.registerPerTenantJob(jobConfig);
      } else {
        await this.registerSingleJob(jobConfig);
      }
    }

    Debug.log({
      module: "QueueManager",
      context: "registerRecurringJobs",
      message: `Registered ${recurringJobs.length} recurring job types`,
    });
  }

  private async registerPerTenantJob(
    config: RecurringJobConfig,
  ): Promise<void> {
    const tenants = await this.client.query(api.helpers.orm.list_s, {
      tableName: "tenants",
    });

    for (const tenant of tenants) {
      const dataSource = await this.client.query(api.helpers.orm.get_s, {
        tableName: "data_sources",
        id: tenant.dataSourceId,
      });

      if (!dataSource || dataSource.type !== "microsoft-365") {
        continue;
      }

      await this.queue.add(
        config.name,
        {
          action: config.action,
          tenantId: tenant._id,
          dataSourceId: dataSource._id,
        },
        {
          repeat: {
            pattern: config.pattern,
          },
          jobId: `recurring-${config.name}-${tenant._id}`,
          priority: config.priority,
        },
      );
    }
  }

  private async registerSingleJob(config: RecurringJobConfig): Promise<void> {
    await this.queue.add(
      config.name,
      {
        action: config.action,
        tenantId: "" as Id<"tenants">,
        dataSourceId: "" as Id<"data_sources">,
      },
      {
        repeat: {
          pattern: config.pattern,
        },
        jobId: `recurring-${config.name}`,
        priority: config.priority,
      },
    );
  }

  async getJobStatus(jobId: string): Promise<any> {
    const job = await this.queue.getJob(jobId);
    if (!job) {
      return null;
    }

    return {
      id: job.id,
      name: job.name,
      data: job.data,
      state: await job.getState(),
      progress: job.progress,
      attemptsMade: job.attemptsMade,
      timestamp: job.timestamp,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
    };
  }

  async healthCheck(): Promise<{
    healthy: boolean;
    redis: boolean;
    queue: boolean;
    worker: boolean;
  }> {
    const redisHealthy = await RedisManager.ping();
    const queueHealthy = this.queue !== undefined;
    const workerHealthy = this.worker !== undefined && !this.worker.isPaused();

    return {
      healthy: redisHealthy && queueHealthy && workerHealthy,
      redis: redisHealthy,
      queue: queueHealthy,
      worker: workerHealthy,
    };
  }

  async shutdown(): Promise<void> {
    Debug.log({
      module: "QueueManager",
      context: "shutdown",
      message: "Shutting down QueueManager",
    });

    await this.worker?.close();
    await this.queue?.close();
    await this.queueEvents?.close();
    await RedisManager.disconnect();

    this.isInitialized = false;
  }
}

export default QueueManager;
```

---

## Step 5: Feature Flag for Gradual Migration

**File**: `src/lib/featureFlags.ts`

```typescript
interface FeatureFlags {
  USE_BULLMQ: boolean;
  BULLMQ_TENANTS: string[]; // Tenant IDs using BullMQ
}

const flags: FeatureFlags = {
  USE_BULLMQ: process.env.USE_BULLMQ === "true",
  BULLMQ_TENANTS: (process.env.BULLMQ_TENANTS || "").split(",").filter(Boolean),
};

export function shouldUseBullMQ(tenantId?: string): boolean {
  if (!flags.USE_BULLMQ) {
    return false;
  }

  // If no specific tenants configured, use for all
  if (flags.BULLMQ_TENANTS.length === 0) {
    return true;
  }

  // Check if this tenant is in the list
  return tenantId ? flags.BULLMQ_TENANTS.includes(tenantId) : false;
}

export default flags;
```

---

## Step 6: Update Main Entry Point

**File**: `src/index.ts`

```typescript
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import NatsClient from "./lib/nats";
import Scheduler from "./scheduler"; // Old scheduler
import QueueManager from "./queue/QueueManager"; // New queue
import { shouldUseBullMQ } from "./lib/featureFlags";
import Debug from "./lib/debug";

async function main() {
  Debug.log({
    module: "Main",
    context: "startup",
    message: "Starting MSPByte Pipeline",
  });

  // Initialize clients
  const client = new ConvexHttpClient(process.env.CONVEX_URL!);
  await NatsClient.connect();

  // Initialize both systems during migration
  const useBullMQ = shouldUseBullMQ();

  if (useBullMQ) {
    Debug.log({
      module: "Main",
      context: "startup",
      message: "Initializing BullMQ queue system",
    });

    const queueManager = new QueueManager(client, NatsClient);
    await queueManager.initialize();

    // Health check loop
    setInterval(async () => {
      const health = await queueManager.healthCheck();
      if (!health.healthy) {
        Debug.error({
          module: "Main",
          context: "healthCheck",
          message: "QueueManager unhealthy",
          metadata: health,
        });

        // TODO: Alert ops team, consider fallback
      }
    }, 30000); // Every 30 seconds
  } else {
    Debug.log({
      module: "Main",
      context: "startup",
      message: "Using legacy database polling scheduler",
    });

    const scheduler = new Scheduler(client, NatsClient);
    await scheduler.initialize();
  }

  // Initialize rest of pipeline (adapters, processors, etc.)
  // ...

  Debug.log({
    module: "Main",
    context: "startup",
    message: "Pipeline started successfully",
    metadata: { useBullMQ },
  });

  // Graceful shutdown
  process.on("SIGTERM", async () => {
    Debug.log({
      module: "Main",
      context: "shutdown",
      message: "Received SIGTERM, shutting down gracefully",
    });

    if (useBullMQ) {
      const queueManager = new QueueManager(client, NatsClient);
      await queueManager.shutdown();
    }

    await NatsClient.disconnect();
    process.exit(0);
  });
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
```

---

## Step 7: Testing

### Unit Tests

**File**: `tests/queue/QueueManager.test.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import QueueManager from "../../src/queue/QueueManager";
import RedisManager from "../../src/lib/redis";

describe("QueueManager", () => {
  let queueManager: QueueManager;

  beforeAll(async () => {
    // Use test Redis instance
    process.env.REDIS_HOST = "localhost";
    process.env.REDIS_PORT = "6379";

    queueManager = new QueueManager(mockClient, mockNatsClient);
    await queueManager.initialize();
  });

  afterAll(async () => {
    await queueManager.shutdown();
  });

  it("should schedule a job", async () => {
    const jobId = await queueManager.scheduleJob({
      action: "test.action",
      tenantId: "test-tenant",
      dataSourceId: "test-datasource",
      priority: 5,
    });

    expect(jobId).toBeTruthy();

    const status = await queueManager.getJobStatus(jobId);
    expect(status).toBeTruthy();
    expect(status.name).toBe("test.action");
  });

  it("should process jobs in priority order", async () => {
    const lowPriority = await queueManager.scheduleJob({
      action: "low",
      tenantId: "test",
      dataSourceId: "test",
      priority: 1,
    });

    const highPriority = await queueManager.scheduleJob({
      action: "high",
      tenantId: "test",
      dataSourceId: "test",
      priority: 10,
    });

    // Wait for processing
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // High priority should complete first
    const lowStatus = await queueManager.getJobStatus(lowPriority);
    const highStatus = await queueManager.getJobStatus(highPriority);

    expect(highStatus.finishedOn).toBeLessThan(lowStatus.finishedOn);
  });

  it("should handle job failures and retries", async () => {
    const jobId = await queueManager.scheduleJob({
      action: "failing.action",
      tenantId: "test",
      dataSourceId: "test",
    });

    // Wait for retries
    await new Promise((resolve) => setTimeout(resolve, 5000));

    const status = await queueManager.getJobStatus(jobId);
    expect(status.attemptsMade).toBeGreaterThan(1);
  });

  it("should pass health check", async () => {
    const health = await queueManager.healthCheck();
    expect(health.healthy).toBe(true);
    expect(health.redis).toBe(true);
    expect(health.queue).toBe(true);
    expect(health.worker).toBe(true);
  });
});
```

### Integration Tests

```typescript
describe('QueueManager Integration', () => {
  it('should recover jobs after Redis restart', async () => {
    // Schedule jobs
    await queueManager.scheduleJob({ ... });
    await queueManager.scheduleJob({ ... });

    // Restart Redis
    await RedisManager.disconnect();
    // (Redis restarts with persistence)
    await RedisManager.getConnection();

    // Jobs should still be there
    const health = await queueManager.healthCheck();
    expect(health.healthy).toBe(true);
  });

  it('should handle recurring jobs', async () => {
    // Wait for first occurrence
    await new Promise(resolve => setTimeout(resolve, 65000)); // >1 minute

    // Check job was created
    const jobs = await queue.getJobs(['completed']);
    const recurringJob = jobs.find(j => j.name === 'sync-identities');
    expect(recurringJob).toBeTruthy();
  });
});
```

---

## Step 8: Monitoring & Alerts

### Health Check Endpoint

**File**: `src/api/health.ts`

```typescript
import express from "express";
import QueueManager from "../queue/QueueManager";

const router = express.Router();

router.get("/health", async (req, res) => {
  const health = await queueManager.healthCheck();

  res.status(health.healthy ? 200 : 503).json({
    status: health.healthy ? "healthy" : "unhealthy",
    components: {
      redis: health.redis ? "up" : "down",
      queue: health.queue ? "up" : "down",
      worker: health.worker ? "up" : "down",
    },
    timestamp: new Date().toISOString(),
  });
});

export default router;
```

### Metrics Collection

```typescript
// Future: Add Prometheus metrics
import { register, Counter, Histogram } from "prom-client";

const jobsProcessed = new Counter({
  name: "pipeline_jobs_processed_total",
  help: "Total number of jobs processed",
  labelNames: ["action", "status"],
});

const jobDuration = new Histogram({
  name: "pipeline_job_duration_seconds",
  help: "Job processing duration",
  labelNames: ["action"],
  buckets: [0.1, 0.5, 1, 5, 10, 30, 60],
});

// In worker.on('completed'):
jobsProcessed.inc({ action: job.name, status: "completed" });
jobDuration.observe(
  { action: job.name },
  (Date.now() - job.processedOn!) / 1000,
);
```

---

## Rollback Procedure

If issues arise:

1. **Set feature flag**:

   ```bash
   export USE_BULLMQ=false
   ```

2. **Restart application**:

   ```bash
   npm restart
   ```

3. **Verify old scheduler running**:

   ```bash
   # Check logs for "Using legacy database polling scheduler"
   ```

4. **Reschedule any lost jobs**:
   ```typescript
   // Query scheduled_jobs table
   // Re-create any jobs that were in BullMQ but not completed
   ```

---

## Success Criteria

- [ ] Redis running with persistence enabled
- [ ] BullMQ successfully scheduling jobs
- [ ] Jobs executing via NATS (same as before)
- [ ] Health checks passing
- [ ] Job latency <1 second (vs 30-60s before)
- [ ] Recurring jobs registering correctly
- [ ] Redis restart doesn't lose jobs
- [ ] Can toggle between old/new with feature flag

---

## Troubleshooting

### Redis Connection Fails

**Symptom**: "Redis connection timeout"

**Solutions**:

1. Check Redis is running: `docker ps | grep redis`
2. Test connection: `redis-cli ping`
3. Check environment variables
4. Verify firewall rules

### Jobs Not Processing

**Symptom**: Jobs added but never complete

**Solutions**:

1. Check worker is running: `queueManager.healthCheck()`
2. Look for worker errors in logs
3. Verify NATS is connected
4. Check job data is valid

### Memory Issues

**Symptom**: Redis using too much memory

**Solutions**:

1. Adjust `removeOnComplete` and `removeOnFail` settings
2. Lower retention counts
3. Increase `maxmemory` in redis.conf
4. Set `maxmemory-policy` to `allkeys-lru`

---

## Next Steps

Once Phase 1 is complete and tested:

**[→ Continue to Phase 2: Logging & Observability](./02_LOGGING_OBSERVABILITY.md)**

---

## Notes for Future Claude Sessions

### Context about this phase:

- We're replacing database polling (60s latency) with BullMQ (push-based, <1s)
- Redis provides job queue + persistence
- QueueManager wraps BullMQ with our business logic
- Feature flags allow gradual migration
- Old scheduler kept as fallback

### Key files created:

- `src/lib/redis.ts` - Redis connection management
- `src/queue/QueueManager.ts` - BullMQ wrapper with recurring jobs
- `src/lib/featureFlags.ts` - Toggle old vs new
- Updated `src/index.ts` - Initialize based on flag

### Integration points:

- QueueManager publishes to NATS (same as old Scheduler)
- Adapters subscribe to NATS (no change needed)
- Database still used for audit trail (optional job_history table)

### Known limitations:

- Requires Redis infrastructure
- Need to migrate recurring job definitions from DB to code
- Health check is simple (could be more comprehensive)

### Extension for Phase 7:

When adding tenant-specific queues (if needed for 1000+ tenants):

```typescript
// Create queue per tenant
const tenantQueue = new Queue(`pipeline-jobs-${tenantId}`, { ... });
```
