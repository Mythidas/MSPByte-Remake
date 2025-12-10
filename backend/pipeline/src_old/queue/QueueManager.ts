import { Queue, Worker, Job, QueueEvents } from "bullmq";
import RedisManager from "../lib/redis.js";
import Logger from "../lib/logger.js";
import TracingManager from "../lib/tracing.js";
import { natsClient } from "../lib/nats.js";
import { SyncEventPayload } from "@workspace/shared/types/integrations/index";

interface JobData {
  action: string;
  tenantId: string;
  dataSourceId: string;
  metadata?: Record<string, any>;
  syncId?: string;
  cursor?: string;
  batchNumber?: number;
}

interface RecurringJobConfig {
  name: string;
  pattern: string; // Cron pattern
  action: string;
  tenantId?: string;
  dataSourceId?: string;
  priority?: number;
  metadata?: Record<string, any>;
}

class QueueManager {
  private queue: Queue;
  private worker: Worker;
  private queueEvents: QueueEvents;
  private isInitialized = false;

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

    // Create worker with configurable concurrency
    const concurrency = parseInt(process.env.QUEUE_CONCURRENCY || "20", 10);
    this.worker = new Worker(
      "pipeline-jobs",
      async (job: Job<JobData>) => {
        return await this.processJob(job);
      },
      {
        connection,
        concurrency,
      },
    );

    // Queue events for monitoring
    this.queueEvents = new QueueEvents("pipeline-jobs", { connection });

    this.setupEventListeners();

    this.isInitialized = true;

    Logger.log({
      module: "QueueManager",
      context: "initialize",
      message: "QueueManager initialized successfully",
    });
  }

  private setupEventListeners(): void {
    // Worker events
    this.worker.on("completed", (job: Job) => {
      Logger.log({
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
      Logger.log({
        module: "QueueManager",
        context: "worker.failed",
        message: `Job ${job?.id} failed: ${error.message}`,
        level: "error",
        error,
        metadata: {
          jobName: job?.name,
          attempts: job?.attemptsMade,
        },
      });
    });

    this.worker.on("error", (error: Error) => {
      Logger.log({
        module: "QueueManager",
        context: "worker.error",
        message: `Worker error: ${error.message}`,
        level: "error",
        error,
      });
    });

    // Queue events
    this.queueEvents.on("waiting", ({ jobId }) => {
      Logger.log({
        module: "QueueManager",
        context: "queue.waiting",
        message: `Job ${jobId} is waiting`,
      });
    });
  }

  private async processJob(job: Job<JobData>): Promise<void> {
    const { action, tenantId, dataSourceId, metadata, syncId } = job.data;

    // Start trace for this job
    TracingManager.startTrace({
      syncId: syncId || `job_${job.id}`,
      tenantId,
      dataSourceId,
      stage: "queue",
      metadata: {
        action,
        jobId: job.id,
        attempt: job.attemptsMade + 1,
      },
    });

    Logger.log({
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

    try {
      // Publish to NATS (existing event flow)
      await natsClient.publish(action, {
        tenantID: tenantId,
        dataSourceID: dataSourceId,
        syncMetadata: metadata,
        syncId,
        jobId: job.id,
        traceId: TracingManager.getContext()?.traceId,
      } as SyncEventPayload);

      Logger.log({
        module: "QueueManager",
        context: "processJob",
        message: `Published ${action} to NATS`,
        metadata: { jobId: job.id, syncId },
      });
    } catch (error) {
      Logger.log({
        module: "QueueManager",
        context: "processJob",
        message: `Failed to process job ${job.id}`,
        level: "error",
        error: error as Error,
      });
      throw error;
    }
  }

  async scheduleJob(params: {
    action: string;
    tenantId: string;
    dataSourceId: string;
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

    Logger.log({
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
    tenantId: string;
    dataSourceId: string;
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

  async scheduleRecurringJob(config: RecurringJobConfig): Promise<void> {
    await this.queue.add(
      config.name,
      {
        action: config.action,
        tenantId: config.tenantId || "",
        dataSourceId: config.dataSourceId || "",
        metadata: config.metadata,
      },
      {
        repeat: {
          pattern: config.pattern,
        },
        priority: config.priority || 5,
      },
    );

    Logger.log({
      module: "QueueManager",
      context: "scheduleRecurringJob",
      message: `Registered recurring job: ${config.name}`,
      metadata: {
        pattern: config.pattern,
        action: config.action,
        tenantId: config.tenantId,
        dataSourceId: config.dataSourceId,
      },
    });
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
    details?: any;
  }> {
    const redisHealth = await RedisManager.healthCheck();
    const queueHealthy = this.queue !== undefined;
    const workerHealthy = this.worker !== undefined && !this.worker.isPaused();

    return {
      healthy: redisHealth.healthy && queueHealthy && workerHealthy,
      redis: redisHealth.healthy,
      queue: queueHealthy,
      worker: workerHealthy,
      details: {
        redisLatency: redisHealth.latency,
        redisError: redisHealth.error,
      },
    };
  }

  async getStats(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
  }> {
    const [waiting, active, completed, failed] = await Promise.all([
      this.queue.getWaitingCount(),
      this.queue.getActiveCount(),
      this.queue.getCompletedCount(),
      this.queue.getFailedCount(),
    ]);

    return { waiting, active, completed, failed };
  }

  async getWorkerStatus(): Promise<{
    activeCount: number;
    waitingCount: number;
    concurrency: number;
  }> {
    const [activeCount, waitingCount] = await Promise.all([
      this.queue.getActiveCount(),
      this.queue.getWaitingCount(),
    ]);

    return {
      activeCount,
      waitingCount,
      concurrency: parseInt(process.env.QUEUE_CONCURRENCY || "20", 10),
    };
  }

  async getJobs(
    status?: "waiting" | "active" | "completed" | "failed",
    limit: number = 50,
  ): Promise<any[]> {
    let jobs: Job[] = [];

    if (!status) {
      // Get all jobs
      const [waiting, active, completed, failed] = await Promise.all([
        this.queue.getWaiting(0, limit / 4),
        this.queue.getActive(0, limit / 4),
        this.queue.getCompleted(0, limit / 4),
        this.queue.getFailed(0, limit / 4),
      ]);
      jobs = [...waiting, ...active, ...completed, ...failed];
    } else {
      switch (status) {
        case "waiting":
          jobs = await this.queue.getWaiting(0, limit);
          break;
        case "active":
          jobs = await this.queue.getActive(0, limit);
          break;
        case "completed":
          jobs = await this.queue.getCompleted(0, limit);
          break;
        case "failed":
          jobs = await this.queue.getFailed(0, limit);
          break;
      }
    }

    return Promise.all(
      jobs.map(async (job) => ({
        id: job.id,
        name: job.name,
        data: job.data,
        state: await job.getState(),
        progress: job.progress,
        attemptsMade: job.attemptsMade,
        timestamp: job.timestamp,
        processedOn: job.processedOn,
        finishedOn: job.finishedOn,
      })),
    );
  }

  async clearRepeatableJobs(): Promise<void> {
    const repeatableJobs = await this.queue.getRepeatableJobs();

    for (const job of repeatableJobs) {
      await this.queue.removeRepeatableByKey(job.key);
    }

    Logger.log({
      module: "QueueManager",
      context: "clearRepeatableJobs",
      message: `Cleared ${repeatableJobs.length} repeatable jobs`,
    });
  }

  async shutdown(): Promise<void> {
    Logger.log({
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

export { QueueManager };
export default QueueManager;
