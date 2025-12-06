# Phase 2: Logging & Observability

[← Back to Index](./REFACTOR_INDEX.md) | [← Previous: Infrastructure](./01_INFRASTRUCTURE_SETUP.md) | [Next: Data Context Loader →](./03_DATA_CONTEXT_LOADER.md)

---

## Overview

**Goal**: Add comprehensive tracing and logging to enable debugging production issues

**Duration**: 1 day

**Key Deliverables**:
- Trace IDs linking jobs through entire pipeline
- Structured logging with timing metrics
- Alert history table for debugging alert lifecycle
- Query performance logging

---

## Step 1: Implement Trace ID System

### Trace ID Format

```
Format: {syncId}-{stage}-{timestamp}
Examples:
- sync_abc123_fetch_1701234567890
- sync_abc123_process_1701234568000
- sync_abc123_analyze_mfa_1701234570000
```

### Trace Context

**File**: `src/lib/tracing.ts`

```typescript
import { AsyncLocalStorage } from 'async_hooks';

interface TraceContext {
  traceId: string;
  syncId?: string;
  tenantId?: string;
  dataSourceId?: string;
  stage: string;
  startTime: number;
  metadata: Record<string, any>;
}

class TracingManager {
  private static storage = new AsyncLocalStorage<TraceContext>();

  static startTrace(params: {
    syncId?: string;
    tenantId?: string;
    dataSourceId?: string;
    stage: string;
    metadata?: Record<string, any>;
  }): string {
    const traceId = `${params.syncId || 'job'}_${params.stage}_${Date.now()}`;

    const context: TraceContext = {
      traceId,
      syncId: params.syncId,
      tenantId: params.tenantId,
      dataSourceId: params.dataSourceId,
      stage: params.stage,
      startTime: Date.now(),
      metadata: params.metadata || {},
    };

    this.storage.enterWith(context);
    return traceId;
  }

  static getContext(): TraceContext | undefined {
    return this.storage.getStore();
  }

  static addMetadata(key: string, value: any): void {
    const context = this.getContext();
    if (context) {
      context.metadata[key] = value;
    }
  }

  static getDuration(): number {
    const context = this.getContext();
    return context ? Date.now() - context.startTime : 0;
  }
}

export default TracingManager;
```

---

## Step 2: Enhanced Logging

### Structured Logger

**File**: `src/lib/logger.ts`

```typescript
import Debug from './debug';
import TracingManager from './tracing';

interface LogParams {
  module: string;
  context: string;
  message: string;
  level?: 'info' | 'warn' | 'error';
  metadata?: Record<string, any>;
  error?: Error;
}

class Logger {
  static log(params: LogParams): void {
    const trace = TracingManager.getContext();
    const duration = TracingManager.getDuration();

    const logEntry = {
      timestamp: new Date().toISOString(),
      level: params.level || 'info',
      module: params.module,
      context: params.context,
      message: params.message,

      // Trace information
      traceId: trace?.traceId,
      syncId: trace?.syncId,
      tenantId: trace?.tenantId,
      dataSourceId: trace?.dataSourceId,
      stage: trace?.stage,
      duration_ms: duration,

      // Metadata
      metadata: {
        ...trace?.metadata,
        ...params.metadata,
      },

      // Error information
      error: params.error ? {
        message: params.error.message,
        stack: params.error.stack,
        name: params.error.name,
      } : undefined,
    };

    // Use existing Debug module
    if (params.error) {
      Debug.error(logEntry);
    } else if (params.level === 'warn') {
      Debug.error(logEntry); // Debug module doesn't have warn
    } else {
      Debug.log(logEntry);
    }
  }

  static startStage(stage: string, metadata?: Record<string, any>): void {
    TracingManager.addMetadata('currentStage', stage);
    this.log({
      module: 'Pipeline',
      context: stage,
      message: `Starting ${stage}`,
      metadata,
    });
  }

  static endStage(stage: string, metadata?: Record<string, any>): void {
    const duration = TracingManager.getDuration();
    this.log({
      module: 'Pipeline',
      context: stage,
      message: `Completed ${stage}`,
      metadata: {
        ...metadata,
        stage_duration_ms: duration,
      },
    });
  }

  static logQuery(params: {
    tableName: string;
    operation: string;
    recordsAffected?: number;
    duration: number;
  }): void {
    this.log({
      module: 'Database',
      context: 'query',
      message: `${params.operation} on ${params.tableName}`,
      metadata: {
        table: params.tableName,
        operation: params.operation,
        records: params.recordsAffected,
        query_duration_ms: params.duration,
      },
    });
  }
}

export default Logger;
```

---

## Step 3: Alert History Table

### Database Schema

**File**: `convex/schema.ts` (add to existing schema)

```typescript
defineTable("entity_alert_history", {
  alertId: v.id("entity_alerts"),
  entityId: v.id("entities"),
  tenantId: v.id("tenants"),
  dataSourceId: v.id("data_sources"),

  alertType: v.string(),
  previousStatus: v.union(v.literal("active"), v.literal("resolved"), v.literal("snoozed")),
  newStatus: v.union(v.literal("active"), v.literal("resolved"), v.literal("snoozed")),

  previousSeverity: v.optional(v.string()),
  newSeverity: v.optional(v.string()),

  changedAt: v.number(),
  changedBy: v.string(), // "analysis_run_{id}" or "user_{id}"

  metadata: v.optional(v.any()), // Analysis details, user action, etc.

  // Trace information
  traceId: v.optional(v.string()),
  syncId: v.optional(v.string()),
})
  .index("by_alert", ["alertId"])
  .index("by_entity", ["entityId", "changedAt"])
  .index("by_tenant", ["tenantId", "changedAt"])
  .index("by_sync", ["syncId"]);
```

### Alert History Helper

**File**: `src/lib/alertHistory.ts`

```typescript
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../convex/_generated/api';
import { Id, Doc } from '../../convex/_generated/dataModel';
import TracingManager from './tracing';

class AlertHistoryManager {
  constructor(private client: ConvexHttpClient) {}

  async recordChange(params: {
    alertId: Id<'entity_alerts'>;
    alert: Doc<'entity_alerts'>;
    previousStatus: string;
    newStatus: string;
    previousSeverity?: string;
    newSeverity?: string;
    changedBy: string;
    metadata?: Record<string, any>;
  }): Promise<void> {
    const trace = TracingManager.getContext();

    await this.client.mutation(api.helpers.orm.insert_s, {
      tableName: 'entity_alert_history',
      record: {
        alertId: params.alertId,
        entityId: params.alert.entityId,
        tenantId: params.alert.tenantId,
        dataSourceId: params.alert.dataSourceId,
        alertType: params.alert.alertType,

        previousStatus: params.previousStatus,
        newStatus: params.newStatus,
        previousSeverity: params.previousSeverity,
        newSeverity: params.newSeverity,

        changedAt: Date.now(),
        changedBy: params.changedBy,
        metadata: params.metadata,

        traceId: trace?.traceId,
        syncId: trace?.syncId,
      },
    });
  }

  async getHistory(alertId: Id<'entity_alerts'>): Promise<Doc<'entity_alert_history'>[]> {
    return await this.client.query(api.helpers.orm.list_s, {
      tableName: 'entity_alert_history',
      index: {
        name: 'by_alert',
        params: { alertId },
      },
    });
  }

  async getEntityHistory(
    entityId: Id<'entities'>,
    limit = 100
  ): Promise<Doc<'entity_alert_history'>[]> {
    const history = await this.client.query(api.helpers.orm.list_s, {
      tableName: 'entity_alert_history',
      index: {
        name: 'by_entity',
        params: { entityId },
      },
    });

    return history
      .sort((a, b) => b.changedAt - a.changedAt)
      .slice(0, limit);
  }
}

export default AlertHistoryManager;
```

---

## Step 4: Query Performance Logging

### Query Wrapper

**File**: `src/lib/queryWrapper.ts`

```typescript
import { ConvexHttpClient } from 'convex/browser';
import Logger from './logger';

export async function timedQuery<T>(
  client: ConvexHttpClient,
  operation: string,
  tableName: string,
  queryFn: () => Promise<T>
): Promise<T> {
  const startTime = Date.now();

  try {
    const result = await queryFn();
    const duration = Date.now() - startTime;

    const recordsAffected = Array.isArray(result) ? result.length : 1;

    Logger.logQuery({
      tableName,
      operation,
      recordsAffected,
      duration,
    });

    // Warn on slow queries
    if (duration > 1000) {
      Logger.log({
        module: 'Database',
        context: 'slow_query',
        message: `Slow query detected: ${operation} on ${tableName}`,
        level: 'warn',
        metadata: {
          duration_ms: duration,
          records: recordsAffected,
        },
      });
    }

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;

    Logger.log({
      module: 'Database',
      context: 'query_error',
      message: `Query failed: ${operation} on ${tableName}`,
      level: 'error',
      error: error as Error,
      metadata: {
        duration_ms: duration,
      },
    });

    throw error;
  }
}
```

---

## Step 5: Update Pipeline to Use Tracing

### Update QueueManager

```typescript
// In QueueManager.processJob
private async processJob(job: Job<JobData>): Promise<void> {
  const { action, tenantId, dataSourceId, syncId } = job.data;

  // Start trace
  TracingManager.startTrace({
    syncId: syncId || `job_${job.id}`,
    tenantId,
    dataSourceId,
    stage: 'queue',
    metadata: {
      action,
      jobId: job.id,
      attempt: job.attemptsMade + 1,
    },
  });

  Logger.log({
    module: 'QueueManager',
    context: 'processJob',
    message: `Processing job: ${action}`,
  });

  try {
    await this.natsClient.publish(action, {
      tenantId,
      dataSourceId,
      metadata: job.data.metadata,
      syncId,
      jobId: job.id,
      traceId: TracingManager.getContext()?.traceId,
    });

    Logger.log({
      module: 'QueueManager',
      context: 'processJob',
      message: `Successfully published to NATS`,
    });
  } catch (error) {
    Logger.log({
      module: 'QueueManager',
      context: 'processJob',
      message: `Failed to process job`,
      level: 'error',
      error: error as Error,
    });
    throw error;
  }
}
```

### Update Adapters

```typescript
// In Microsoft365Adapter
async execute(event: SyncEvent) {
  // Continue trace or start new one
  if (event.traceId) {
    TracingManager.startTrace({
      syncId: event.syncId,
      tenantId: event.tenantId,
      dataSourceId: event.dataSourceId,
      stage: 'fetch',
      metadata: { action: event.action },
    });
  }

  Logger.startStage('fetch', {
    entityType: event.action.split('.').pop(),
  });

  try {
    // Fetch data...
    const result = await timedQuery(
      this.client,
      'fetch_entities',
      'entities',
      async () => {
        // Actual query
      }
    );

    Logger.endStage('fetch', {
      recordsFetched: result.length,
    });
  } catch (error) {
    Logger.log({
      module: 'Adapter',
      context: 'fetch_error',
      message: 'Failed to fetch entities',
      level: 'error',
      error: error as Error,
    });
    throw error;
  }
}
```

---

## Step 6: Update AlertManager with History

```typescript
// In AlertManager.processAnalysisBatch
private async processAnalysisBatch(
  tenantId: Id<'tenants'>,
  dataSourceId: Id<'data_sources'>,
  analysisEvents: Map<string, AnalysisEvent>
): Promise<void> {
  Logger.startStage('alert_processing', {
    tenantId,
    dataSourceId,
    eventCount: analysisEvents.size,
  });

  const historyManager = new AlertHistoryManager(this.client);

  // ... existing logic ...

  // When creating new alert
  const newAlert = await this.client.mutation(/* create alert */);

  await historyManager.recordChange({
    alertId: newAlert._id,
    alert: newAlert,
    previousStatus: 'none',
    newStatus: 'active',
    newSeverity: newAlert.severity,
    changedBy: `analysis_${TracingManager.getContext()?.traceId}`,
    metadata: {
      findingsCount: findings.length,
      analysisType: event.analysisType,
    },
  });

  // When resolving alert
  await historyManager.recordChange({
    alertId: alert._id,
    alert: alert,
    previousStatus: 'active',
    newStatus: 'resolved',
    changedBy: `analysis_${TracingManager.getContext()?.traceId}`,
    metadata: {
      reason: 'no_findings',
      analysisType: ownerType,
    },
  });

  Logger.endStage('alert_processing', {
    alertsCreated: newAlerts.length,
    alertsUpdated: updates.length,
    alertsResolved: resolves.length,
  });
}
```

---

## Step 7: Create Debugging Utilities

### Log Viewer Script

**File**: `scripts/viewLogs.ts`

```typescript
// Parse and filter logs for specific trace/sync
import fs from 'fs';

interface LogEntry {
  timestamp: string;
  level: string;
  module: string;
  context: string;
  message: string;
  traceId?: string;
  syncId?: string;
  duration_ms?: number;
  metadata?: any;
}

function viewLogsByTrace(logFile: string, traceId: string): void {
  const logs = fs.readFileSync(logFile, 'utf-8')
    .split('\n')
    .filter(Boolean)
    .map(line => JSON.parse(line) as LogEntry)
    .filter(log => log.traceId === traceId || log.syncId?.includes(traceId));

  console.log(`\n=== Trace: ${traceId} ===\n`);

  logs.forEach(log => {
    console.log(`[${log.timestamp}] ${log.module}:${log.context}`);
    console.log(`  ${log.message}`);
    if (log.duration_ms) {
      console.log(`  Duration: ${log.duration_ms}ms`);
    }
    if (log.metadata) {
      console.log(`  Metadata:`, JSON.stringify(log.metadata, null, 2));
    }
    console.log();
  });

  // Summary
  const totalDuration = logs.reduce((sum, log) => sum + (log.duration_ms || 0), 0);
  console.log(`\nTotal Duration: ${totalDuration}ms`);
  console.log(`Stages: ${logs.filter(l => l.context.includes('stage')).length}`);
  console.log(`Queries: ${logs.filter(l => l.module === 'Database').length}`);
}
```

---

## Testing

### Trace Continuity Test

```typescript
it('should maintain trace context across pipeline', async () => {
  const syncId = 'test_sync_123';

  // Schedule job with syncId
  await queueManager.scheduleJob({
    action: 'test.sync',
    tenantId: 'test',
    dataSourceId: 'test',
    metadata: { syncId },
  });

  // Wait for processing
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Check logs for trace
  const logs = await getLogs();
  const traceLogs = logs.filter(l => l.syncId === syncId);

  // Should have logs from all stages
  const stages = new Set(traceLogs.map(l => l.stage));
  expect(stages.has('queue')).toBe(true);
  expect(stages.has('fetch')).toBe(true);
  expect(stages.has('process')).toBe(true);
  expect(stages.has('analyze')).toBe(true);
});
```

---

## Success Criteria

- [ ] All pipeline stages emit logs with trace IDs
- [ ] Can trace single job from schedule to alert
- [ ] Alert history table records all state changes
- [ ] Slow queries automatically logged
- [ ] Log viewer script works for debugging
- [ ] Timing metrics show where time is spent

---

[→ Next: Phase 3 - Data Context Loader](./03_DATA_CONTEXT_LOADER.md)
