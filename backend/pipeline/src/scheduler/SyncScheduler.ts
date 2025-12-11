import { ConvexHttpClient } from "convex/browser";
import { api } from "@workspace/database/convex/_generated/api.js";
import { v4 as uuid } from "uuid";
import { QueueNames, queueManager } from "../lib/queue.js";
import { Logger } from "../lib/logger.js";
import type { Doc, Id } from "@workspace/database/convex/_generated/dataModel";
import type { IntegrationId } from "@workspace/shared/types/integrations";
import { INTEGRATIONS } from "@workspace/shared/types/integrations/config";

/**
 * SyncScheduler - Manages initial sync job scheduling for all datasources
 *
 * Responsibilities:
 * 1. Query all active datasources from database
 * 2. For each datasource, schedule sync jobs for all supported entity types
 * 3. Jobs self-schedule next run based on integration config (rateMinutes)
 *
 * Scheduling strategy:
 * - Each entity type has its own queue: sync:{integration}:{type}
 * - Jobs are prioritized based on integration config
 * - After first sync completes, adapter schedules next run automatically
 */
export class SyncScheduler {
  private convex: ConvexHttpClient;
  private secret: string;

  constructor(convexUrl: string) {
    this.convex = new ConvexHttpClient(convexUrl);

    // Validate CONVEX_API_KEY is set
    this.secret = process.env.CONVEX_API_KEY || "";
    if (!this.secret) {
      throw new Error(
        "CONVEX_API_KEY environment variable is required for SyncScheduler",
      );
    }
  }

  /**
   * Schedule initial sync jobs for all active datasources
   * Called once on pipeline startup
   */
  async scheduleAllDatasources(): Promise<void> {
    Logger.log({
      module: "SyncScheduler",
      context: "scheduleAllDatasources",
      message: "Querying all active datasources...",
      level: "info",
    });

    // Query all datasources (no filters = all active datasources)
    const datasources = (await this.convex.query(api.helpers.orm.list_s, {
      tableName: "data_sources",
      secret: this.secret,
    })) as any[];

    Logger.log({
      module: "SyncScheduler",
      context: "scheduleAllDatasources",
      message: `Found ${datasources.length} datasources`,
      level: "info",
    });

    // Clear stale jobs from all sync queues before scheduling
    await this.clearStaleJobs(datasources);

    // Schedule sync jobs for each datasource
    for (const datasource of datasources) {
      await this.scheduleDatasource(datasource);
    }

    Logger.log({
      module: "SyncScheduler",
      context: "scheduleAllDatasources",
      message: `Scheduled sync jobs for ${datasources.length} datasources`,
      level: "info",
    });
  }

  /**
   * Clear waiting and delayed jobs from all sync queues
   * This prevents duplicate jobs when pipeline restarts
   */
  private async clearStaleJobs(
    datasources: Doc<"data_sources">[],
  ): Promise<void> {
    Logger.log({
      module: "SyncScheduler",
      context: "clearStaleJobs",
      message: "Clearing stale jobs from all sync queues...",
      level: "info",
    });

    // Collect all unique queue names from datasources
    const queueNames = new Set<string>();
    for (const datasource of datasources) {
      const integration =
        INTEGRATIONS[datasource.integrationId as IntegrationId];
      if (integration) {
        for (const typeConfig of integration.supportedTypes) {
          const queueName = QueueNames.sync(
            datasource.integrationId,
            typeConfig.type,
          );
          queueNames.add(queueName);
        }
      }
    }

    // Clear waiting/delayed jobs from each queue (preserves active jobs)
    let totalCleared = 0;
    for (const queueName of queueNames) {
      const cleared = await queueManager.clearWaitingAndDelayedJobs(queueName);
      totalCleared += cleared;
    }

    Logger.log({
      module: "SyncScheduler",
      context: "clearStaleJobs",
      message: `Cleared ${totalCleared} stale jobs from ${queueNames.size} queues`,
      level: "info",
    });
  }

  /**
   * Schedule sync jobs for a single datasource
   */
  private async scheduleDatasource(
    datasource: Doc<"data_sources">,
  ): Promise<void> {
    const { _id, integrationId, tenantId, isPrimary } = datasource;
    if (!tenantId) {
      Logger.log({
        module: "SyncScheduler",
        context: "scheduleDatasource",
        message: `No tenant id: ${tenantId}`,
        level: "error",
      });
    }

    if (integrationId === "microsoft-365" && isPrimary) {
      Logger.log({
        module: "SyncScheduler",
        context: "scheduleDatasource",
        message: `Skipping primary Microsoft365 Datasource: ${tenantId}`,
        level: "trace",
      });

      return;
    }

    const integration = INTEGRATIONS[integrationId as IntegrationId];
    if (!integration) {
      Logger.log({
        module: "SyncScheduler",
        context: "scheduleDatasource",
        message: `Unknown integration: ${integrationId}`,
        level: "warn",
      });
      return;
    }

    Logger.log({
      module: "SyncScheduler",
      context: "scheduleDatasource",
      message: `Scheduling ${integration.supportedTypes.length} entity types for ${integrationId} datasource ${_id}`,
      level: "info",
    });

    // Schedule sync job for each supported entity type
    for (const typeConfig of integration.supportedTypes) {
      const queueName = QueueNames.sync(integrationId, typeConfig.type);
      const syncId = uuid();

      await queueManager.addJob(
        queueName,
        {
          tenantId: tenantId as Id<"tenants">,
          integrationId,
          dataSourceId: _id as Id<"data_sources">,
          entityType: typeConfig.type,
          syncId,
          batchNumber: 0,
        },
        {
          delay: typeConfig.rateMinutes * 60 * 1000,
          priority: typeConfig.priority,
        },
      );

      Logger.log({
        module: "SyncScheduler",
        context: "scheduleDatasource",
        message: `Scheduled ${integrationId}:${typeConfig.type} (priority: ${typeConfig.priority}, rate: ${typeConfig.rateMinutes}m)`,
        level: "trace",
      });
    }
  }

  /**
   * Schedule sync for a specific datasource (useful for manual triggers)
   */
  async scheduleSingleDatasource(
    dataSourceId: Id<"data_sources">,
  ): Promise<void> {
    const datasource = (await this.convex.query(api.helpers.orm.get_s, {
      tableName: "data_sources",
      id: dataSourceId,
      secret: this.secret,
    })) as any;

    if (!datasource) {
      throw new Error(`Datasource not found: ${dataSourceId}`);
    }

    await this.scheduleDatasource(datasource);
  }
}
