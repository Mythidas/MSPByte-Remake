import { Queue, Worker, Job, QueueOptions, WorkerOptions } from "bullmq";
import { redis } from "./redis.js";
import { Logger } from "./logger.js";
import type { Id } from "@workspace/database/convex/_generated/dataModel";
import type {
  IntegrationId,
  EntityType,
} from "@workspace/shared/types/integrations";
import type { JobMetrics } from "./JobHistoryManager.js";

/**
 * Job data structures for pipeline stages
 * All stages include optional metrics field for accumulating pipeline metrics
 */

// Sync job: Trigger adapter to fetch data from external API
export interface SyncJobData {
  tenantId: Id<"tenants">;
  integrationId: IntegrationId;
  dataSourceId: Id<"data_sources">;
  entityType: EntityType;
  cursor?: string; // For pagination
  batchNumber?: number;
  syncId: string; // UUID for mark-and-sweep deletion
  startedAt?: number; // Pipeline start timestamp (set by adapter)
  metrics?: JobMetrics; // Accumulated metrics from previous stages
}

// Process job: Save entities to database
export interface ProcessJobData {
  tenantId: Id<"tenants">;
  integrationId: IntegrationId;
  dataSourceId: Id<"data_sources">;
  entityType: EntityType;
  entities: Array<{
    externalId: string;
    siteId?: string;
    rawData: any;
  }>;
  syncId: string;
  siteId?: Id<"sites">,
  startedAt?: number; // Pipeline start timestamp
  metrics?: JobMetrics; // Accumulated metrics from adapter stage
}

// Link job: Create relationships between entities
export interface LinkJobData {
  tenantId: Id<"tenants">;
  integrationId: IntegrationId;
  dataSourceId: Id<"data_sources">;
  syncId: string;
  siteId?: Id<"sites">;
  startedAt?: number; // Pipeline start timestamp
  metrics?: JobMetrics; // Accumulated metrics from adapter + processor stages
}

// Analyze job: Run analyzers and generate alerts
export interface AnalyzeJobData {
  tenantId: Id<"tenants">;
  integrationId: IntegrationId;
  dataSourceId: Id<"data_sources">;
  syncId: string;
  siteId?: Id<"sites">;
  entityType?: EntityType; // For action naming in job_history
  startedAt?: number; // Pipeline start timestamp
  metrics?: JobMetrics; // Accumulated metrics from all previous stages
}

/**
 * Queue names following the pattern: {stage}.{integration}?.{type}?
 */
export const QueueNames = {
  // Adapter stage: sync.microsoft-365.identities
  sync: (integrationId: IntegrationId, entityType: EntityType) =>
    `sync.${integrationId}.${entityType}`,

  // Processor stage: process.entity
  process: "process.entity",

  // Linker stage: link.microsoft-365
  link: (integrationId: IntegrationId) => `link.${integrationId}`,

  // Analyzer stage: analyze.tenant
  analyze: "analyze.tenant",
} as const;

/**
 * Get default queue options (lazy initialization for Redis connection)
 */
const getDefaultQueueOptions = (): QueueOptions => ({
  connection: redis.getClient(),
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000,
    },
    removeOnComplete: {
      count: 100, // Keep last 100 completed jobs for debugging
    },
    removeOnFail: {
      count: 500, // Keep last 500 failed jobs for analysis
    },
  },
});

/**
 * Queue manager for creating and managing BullMQ queues
 */
class QueueManager {
  private queues = new Map<string, Queue>();
  private workers = new Map<string, Worker>();

  /**
   * Get or create a queue
   */
  getQueue(queueName: string): Queue {
    if (!this.queues.has(queueName)) {
      const queue = new Queue(queueName, getDefaultQueueOptions());

      // Event handlers for monitoring
      queue.on("error", (error: Error) => {
        Logger.log({
          module: "QueueManager",
          context: "getQueue",
          message: `Queue error [${queueName}]: ${error.message}`,
          level: "error",
        });
      });

      this.queues.set(queueName, queue);
      Logger.log({
        module: "QueueManager",
        context: "getQueue",
        message: `Queue created: ${queueName}`,
        level: "info",
      });
    }

    return this.queues.get(queueName)!;
  }

  /**
   * Create a worker for processing jobs from a queue
   */
  createWorker<T = any>(
    queueName: string,
    processor: (job: Job<T>) => Promise<any>,
    options?: Partial<WorkerOptions>,
  ): Worker<T> {
    const workerKey = `${queueName}-worker`;

    if (this.workers.has(workerKey)) {
      throw new Error(`Worker already exists for queue: ${queueName}`);
    }

    const worker = new Worker<T>(
      queueName,
      async (job: Job<T>) => {
        const startTime = Date.now();
        Logger.log({
          module: "QueueManager",
          context: "createWorker",
          message: `Processing job [${queueName}] ${job.id}`,
          level: "info",
        });

        try {
          const result = await processor(job);
          const duration = Date.now() - startTime;

          Logger.log({
            module: "QueueManager",
            context: "createWorker",
            message: `Job completed [${queueName}] ${job.id} in ${duration}ms`,
            level: "info",
          });

          return result;
        } catch (error) {
          const duration = Date.now() - startTime;
          Logger.log({
            module: "QueueManager",
            context: "createWorker",
            message: `Job failed [${queueName}] ${job.id} after ${duration}ms: ${error}`,
            level: "error",
          });
          throw error;
        }
      },
      {
        connection: getDefaultQueueOptions().connection,
        concurrency: options?.concurrency || 5,
        ...options,
      },
    );

    // Worker event handlers
    worker.on("completed", (job: Job) => {
      Logger.log({
        module: "QueueManager",
        context: "createWorker",
        message: `Worker completed job [${queueName}] ${job.id}`,
        level: "trace",
      });
    });

    worker.on("failed", (job: Job | undefined, error: Error) => {
      Logger.log({
        module: "QueueManager",
        context: "createWorker",
        message: `Worker failed job [${queueName}] ${job?.id}: ${error.message}`,
        level: "error",
      });
    });

    worker.on("error", (error: Error) => {
      Logger.log({
        module: "QueueManager",
        context: "createWorker",
        message: `Worker error [${queueName}]: ${error.message}`,
        level: "error",
      });
    });

    this.workers.set(workerKey, worker);
    Logger.log({
      module: "QueueManager",
      context: "createWorker",
      message: `Worker created for queue: ${queueName}`,
      level: "info",
    });

    return worker;
  }

  /**
   * Add a job to a queue
   */
  async addJob<T>(
    queueName: string,
    jobData: T,
    options?: {
      priority?: number;
      delay?: number;
      jobId?: string;
    },
  ): Promise<Job<T>> {
    const queue = this.getQueue(queueName);
    return queue.add(queueName, jobData, options);
  }

  /**
   * Check if a job already exists for a specific datasource + entityType combination
   */
  async hasJobForDatasource(
    queueName: string,
    dataSourceId: Id<"data_sources">,
    entityType: EntityType,
  ): Promise<boolean> {
    const queue = this.getQueue(queueName);

    // Check waiting jobs
    const waitingJobs = await queue.getJobs(["waiting", "delayed"]);
    const hasJob = waitingJobs.some(
      (job) =>
        (job.data as SyncJobData).dataSourceId === dataSourceId &&
        (job.data as SyncJobData).entityType === entityType,
    );

    return hasJob;
  }

  /**
   * Clear all waiting and delayed jobs from a queue (preserves active jobs)
   */
  async clearWaitingAndDelayedJobs(queueName: string): Promise<number> {
    const queue = this.getQueue(queueName);

    // Get all waiting and delayed jobs
    const waitingJobs = await queue.getJobs(["waiting"]);
    const delayedJobs = await queue.getJobs(["delayed"]);
    const allJobs = [...waitingJobs, ...delayedJobs];

    // Remove each job
    let removedCount = 0;
    for (const job of allJobs) {
      await job.remove();
      removedCount++;
    }

    Logger.log({
      module: "QueueManager",
      context: "clearWaitingAndDelayedJobs",
      message: `Cleared ${removedCount} waiting/delayed jobs from queue: ${queueName}`,
      level: "info",
    });

    return removedCount;
  }

  /**
   * Gracefully close all queues and workers
   */
  async closeAll(): Promise<void> {
    Logger.log({
      module: "QueueManager",
      context: "closeAll",
      message: "Closing all queues and workers...",
      level: "info",
    });

    // Close all workers
    for (const [key, worker] of this.workers.entries()) {
      await worker.close();
      Logger.log({
        module: "QueueManager",
        context: "closeAll",
        message: `Worker closed: ${key}`,
        level: "info",
      });
    }

    // Close all queues
    for (const [name, queue] of this.queues.entries()) {
      await queue.close();
      Logger.log({
        module: "QueueManager",
        context: "closeAll",
        message: `Queue closed: ${name}`,
        level: "info",
      });
    }

    this.workers.clear();
    this.queues.clear();
  }

  /**
   * Get queue health status
   */
  async getQueueHealth(queueName: string): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }> {
    const queue = this.getQueue(queueName);
    const counts = await queue.getJobCounts();
    return counts as any;
  }
}

// Singleton instance
export const queueManager = new QueueManager();
