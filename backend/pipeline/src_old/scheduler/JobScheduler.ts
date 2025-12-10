/**
 * Job Scheduler - Automatic Job Scheduling
 *
 * Replaces the old Scheduler with BullMQ repeatable jobs.
 * Reads sync schedules from integrations.supportedTypes.rateMinutes
 * and registers repeatable jobs for each active data source.
 *
 * Key Features:
 * - No database polling (BullMQ handles scheduling in Redis)
 * - Dynamic schedules from database
 * - Automatic job firing based on cron patterns
 * - Respects integration-specific sync frequencies
 *
 * Usage:
 *   const scheduler = new JobScheduler(queueManager);
 *   await scheduler.initialize();
 */

import { api } from "@workspace/database/convex/_generated/api.js";
import type {
  Doc,
  Id,
} from "@workspace/database/convex/_generated/dataModel.js";
import { client } from "@workspace/shared/lib/convex.js";
import Logger from "../lib/logger.js";
import type { QueueManager } from "../queue/QueueManager.js";

export interface ScheduledJobConfig {
  name: string; // Unique name for the repeatable job
  action: string; // NATS action (e.g., "microsoft-365.sync.identities")
  tenantId: Id<"tenants">;
  dataSourceId: Id<"data_sources">;
  integrationSlug: string;
  entityType: string;
  pattern: string; // Cron pattern
  rateMinutes: number; // Original rate in minutes
  priority: number;
}

export class JobScheduler {
  private queueManager: QueueManager;
  private scheduledJobs: Map<string, ScheduledJobConfig> = new Map();

  constructor(queueManager: QueueManager) {
    this.queueManager = queueManager;
  }

  /**
   * Initialize scheduler by reading from database and registering jobs
   */
  public async initialize(): Promise<void> {
    Logger.log({
      module: "JobScheduler",
      context: "initialize",
      message: "Initializing job scheduler...",
    });

    // Check for required environment variables
    if (!process.env.CONVEX_URL) {
      throw new Error(
        "CONVEX_URL environment variable is required for JobScheduler",
      );
    }
    if (!process.env.CONVEX_API_KEY) {
      throw new Error(
        "CONVEX_API_KEY environment variable is required for JobScheduler",
      );
    }

    try {
      // 1. Load all active integrations
      const integrations = await this.loadActiveIntegrations();
      Logger.log({
        module: "JobScheduler",
        context: "initialize",
        message: `Loaded ${integrations.length} active integrations`,
      });

      // 2. Load all active data sources
      const dataSources = await this.loadActiveDataSources();
      Logger.log({
        module: "JobScheduler",
        context: "initialize",
        message: `Loaded ${dataSources.length} active data sources`,
      });

      // 3. Register jobs for each data source + entity type combination
      let registeredCount = 0;
      for (const dataSource of dataSources) {
        const integration = integrations.find(
          (i) => i._id === dataSource.integrationId,
        );
        if (!integration) {
          Logger.log({
            module: "JobScheduler",
            context: "initialize",
            message: `Skipping data source ${dataSource._id}: integration not found`,
            level: "warn",
          });
          continue;
        }

        const jobsForSource = await this.registerJobsForDataSource(
          dataSource,
          integration,
        );
        registeredCount += jobsForSource;
      }

      Logger.log({
        module: "JobScheduler",
        context: "initialize",
        message: `Job scheduler initialized: ${registeredCount} repeatable jobs registered`,
        metadata: {
          totalJobs: registeredCount,
          dataSources: dataSources.length,
          integrations: integrations.length,
        },
      });
    } catch (error) {
      Logger.log({
        module: "JobScheduler",
        context: "initialize",
        message: `Failed to initialize job scheduler: ${error}`,
        level: "error",
        error: error as Error,
      });
      throw error;
    }
  }

  /**
   * Load all active integrations from database
   */
  private async loadActiveIntegrations(): Promise<Doc<"integrations">[]> {
    const integrations = (await client.query(api.helpers.orm.list_s, {
      tableName: "integrations",
      secret: process.env.CONVEX_API_KEY!,
      filters: {
        isActive: true,
      },
    })) as Doc<"integrations">[];

    return integrations;
  }

  /**
   * Load all active data sources from database
   */
  private async loadActiveDataSources(): Promise<Doc<"data_sources">[]> {
    const dataSources = (await client.query(api.helpers.orm.list_s, {
      tableName: "data_sources",
      secret: process.env.CONVEX_API_KEY!,
      filters: {
        status: "active",
      },
    })) as Doc<"data_sources">[];

    return dataSources;
  }

  /**
   * Register repeatable jobs for a data source
   */
  private async registerJobsForDataSource(
    dataSource: Doc<"data_sources">,
    integration: Doc<"integrations">,
  ): Promise<number> {
    let count = 0;

    // For each supported entity type, create a repeatable job
    for (const supportedType of integration.supportedTypes) {
      try {
        const jobConfig: ScheduledJobConfig = {
          name: `${dataSource._id}-${supportedType.type}`,
          action: `${integration.slug}.sync.${supportedType.type}`,
          tenantId: dataSource.tenantId,
          dataSourceId: dataSource._id,
          integrationSlug: integration.slug,
          entityType: supportedType.type,
          rateMinutes: supportedType.rateMinutes ?? 60, // Default: hourly
          pattern: this.convertMinutesToCron(supportedType.rateMinutes ?? 60),
          priority: supportedType.priority ?? 5,
        };

        await this.registerRepeatableJob(jobConfig);
        this.scheduledJobs.set(jobConfig.name, jobConfig);
        count++;
      } catch (error) {
        Logger.log({
          module: "JobScheduler",
          context: "registerJobsForDataSource",
          message: `Failed to register job for ${supportedType.type}: ${error}`,
          level: "error",
          error: error as Error,
        });
      }
    }

    return count;
  }

  /**
   * Register a repeatable job with BullMQ
   */
  private async registerRepeatableJob(
    config: ScheduledJobConfig,
  ): Promise<void> {
    await this.queueManager.scheduleRecurringJob({
      name: config.name,
      pattern: config.pattern,
      action: config.action,
      tenantId: config.tenantId,
      dataSourceId: config.dataSourceId,
      priority: config.priority,
      metadata: {
        integrationSlug: config.integrationSlug,
        entityType: config.entityType,
        rateMinutes: config.rateMinutes,
      },
    });

    Logger.log({
      module: "JobScheduler",
      context: "registerRepeatableJob",
      message: `Registered repeatable job: ${config.name}`,
      metadata: {
        action: config.action,
        pattern: config.pattern,
        rateMinutes: config.rateMinutes,
      },
    });
  }

  /**
   * Convert minutes to cron pattern
   *
   * Examples:
   * - 60 min → "0 * * * *" (hourly, at minute 0)
   * - 30 min → "0,30 * * * *" (every 30 minutes)
   * - 15 min → "0,15,30,45 * * * *" (every 15 minutes)
   * - 1440 min (24h) → "0 0 * * *" (daily at midnight)
   */
  private convertMinutesToCron(minutes: number): string {
    // Special cases
    if (minutes === 60) {
      return "0 * * * *"; // Hourly
    }

    if (minutes === 1440) {
      return "0 0 * * *"; // Daily at midnight
    }

    if (minutes === 10080) {
      return "0 0 * * 0"; // Weekly on Sunday at midnight
    }

    // For intervals that divide evenly into 60 minutes
    if (60 % minutes === 0) {
      const intervals = [];
      for (let i = 0; i < 60; i += minutes) {
        intervals.push(i);
      }
      return `${intervals.join(",")} * * * *`;
    }

    // For intervals that divide evenly into a day (1440 minutes)
    if (1440 % minutes === 0) {
      const hoursInterval = minutes / 60;
      const hours = [];
      for (let i = 0; i < 24; i += hoursInterval) {
        hours.push(i);
      }
      return `0 ${hours.join(",")} * * *`;
    }

    // Fallback: Convert to hours if possible, otherwise default to hourly
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      return `0 */${hours} * * *`;
    }

    // Fallback: Use minute interval (works for 1-59 minutes)
    return `*/${minutes} * * * *`;
  }

  /**
   * Get all scheduled jobs
   */
  public getScheduledJobs(): ScheduledJobConfig[] {
    return Array.from(this.scheduledJobs.values());
  }

  /**
   * Get scheduled job by name
   */
  public getScheduledJob(name: string): ScheduledJobConfig | undefined {
    return this.scheduledJobs.get(name);
  }

  /**
   * Reload jobs from database (useful after config changes)
   */
  public async reload(): Promise<void> {
    Logger.log({
      module: "JobScheduler",
      context: "reload",
      message: "Reloading job scheduler...",
    });

    // Clear existing jobs
    this.scheduledJobs.clear();

    // Re-initialize
    await this.initialize();
  }

  /**
   * Stop all repeatable jobs
   */
  public async stop(): Promise<void> {
    Logger.log({
      module: "JobScheduler",
      context: "stop",
      message: "Stopping job scheduler...",
    });

    // BullMQ's repeatable jobs are stored in Redis
    // Clearing the queue will remove them
    await this.queueManager.clearRepeatableJobs();

    this.scheduledJobs.clear();

    Logger.log({
      module: "JobScheduler",
      context: "stop",
      message: "Job scheduler stopped",
    });
  }
}

export default JobScheduler;
