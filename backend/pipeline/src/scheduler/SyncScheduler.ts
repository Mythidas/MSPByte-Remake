import { ConvexHttpClient } from "convex/browser";
import { api } from "@workspace/database/convex/_generated/api.js";
import { v4 as uuid } from "uuid";
import { QueueNames, queueManager } from "../lib/queue.js";
import { Logger } from "../lib/logger.js";
import type { Id } from "@workspace/database/convex/_generated/dataModel";
import type { IntegrationId } from "@workspace/shared/types/integrations";
import { INTEGRATIONS } from "@workspace/shared/types/integrations/config.js";

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
            throw new Error("CONVEX_API_KEY environment variable is required for SyncScheduler");
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
        const datasources = await this.convex.query(api.helpers.orm.list_s, {
            tableName: "data_sources",
            secret: this.secret,
        }) as any[];

        Logger.log({
            module: "SyncScheduler",
            context: "scheduleAllDatasources",
            message: `Found ${datasources.length} datasources`,
            level: "info",
        });

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
     * Schedule sync jobs for a single datasource
     */
    private async scheduleDatasource(datasource: any): Promise<void> {
        const { _id, integrationId, tenantId } = datasource;

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
                    priority: typeConfig.priority,
                }
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
    async scheduleSingleDatasource(dataSourceId: Id<"data_sources">): Promise<void> {
        const datasource = await this.convex.query(api.helpers.orm.get_s, {
            tableName: "data_sources",
            id: dataSourceId,
            secret: this.secret,
        });

        if (!datasource) {
            throw new Error(`Datasource not found: ${dataSourceId}`);
        }

        await this.scheduleDatasource(datasource);
    }
}
