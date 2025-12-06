import { natsClient } from "@workspace/pipeline/helpers/nats.js";
import { Scheduler } from "@workspace/pipeline/scheduler/index.js";
import { api } from "@workspace/database/convex/_generated/api.js";
import { client } from "@workspace/shared/lib/convex.js";
import type { Doc } from "@workspace/database/convex/_generated/dataModel.js";
import Debug from "@workspace/shared/lib/Debug.js";
import { APIResponse } from "@workspace/shared/types/api.js";
import {
    IntegrationType,
    EntityType,
} from "@workspace/shared/types/pipeline/core.js";
import {
    SyncEventPayload,
    DataFetchPayload,
    FetchedEventPayload,
} from "@workspace/shared/types/pipeline/events.js";
import {
    flowResolver,
    buildEventName,
} from "@workspace/shared/types/pipeline/resolver.js";
import { generateUUID } from "@workspace/shared/lib/utils.server.js";

export type RawDataProps = {
    eventData: SyncEventPayload;
    tenantID: string;
    dataSource: Doc<"data_sources">;
    cursor?: string;
    syncId: string;
    batchNumber: number;
};

export type RawDataResult = {
    data: DataFetchPayload[];
    nextCursor?: string;
    hasMore: boolean;
};

export abstract class BaseAdapter {
    constructor(
        protected integrationType: IntegrationType,
        protected supportedEntities: EntityType[]
    ) { }

    async start(): Promise<void> {
        // Subscribe to sync topics for this integration type
        const pattern = `${this.integrationType}.sync.*`;
        await natsClient.subscribe(pattern, this.handleJob.bind(this));
        Debug.log({
            module: "BaseAdapter",
            context: this.integrationType,
            message: `Adapter started, listening to ${pattern}`,
        });
    }

    private async handleJob(syncEvent: SyncEventPayload): Promise<void> {
        const { entityType, job, tenantID } = syncEvent;

        // Validate this adapter supports the requested entity type
        if (!this.supportedEntities.includes(entityType)) {
            Debug.error({
                module: "BaseAdapter",
                context: "handleJob",
                message: `Adapter ${this.integrationType} does not support entity type ${entityType}`,
            });
            await Scheduler.failJob(
                job,
                `Adapter ${this.integrationType} does not support entity type ${entityType}`
            );
            return;
        }

        // Extract pagination metadata from job
        const jobMetadata = job.payload as any;
        const cursor = jobMetadata?.cursor;
        const syncId = jobMetadata?.syncId || generateUUID();
        const batchNumber = (jobMetadata?.batchNumber || 0) + 1;
        const previousTotal = jobMetadata?.totalProcessed || 0;

        Debug.log({
            module: "BaseAdapter",
            context: "handleJob",
            message: `Processing job: ${job._id} (batch ${batchNumber}, syncId: ${syncId})`,
        });

        const dataSource = (await client.query(api.helpers.orm.get_s, {
            id: syncEvent.dataSourceID as any,
            tableName: "data_sources",
            secret: process.env.CONVEX_API_KEY!,
        })) as Doc<"data_sources">;
        if (!dataSource) {
            await Scheduler.failJob(job, "Data source not found");
            return;
        }

        // Update data source sync status
        if (batchNumber === 1) {
            await client.mutation(api.helpers.orm.update_s, {
                tableName: "data_sources",
                data: [{
                    id: dataSource._id,
                    updates: {
                        currentSyncId: syncId,
                    },
                }],
                secret: process.env.CONVEX_API_KEY!,
            });
        }

        const result = await this.getRawData({
            eventData: syncEvent,
            tenantID,
            dataSource,
            cursor,
            syncId,
            batchNumber,
        });
        if (result.error) {
            await Scheduler.failJob(job, result.error.message);
            return;
        }

        const { data: rawData, nextCursor, hasMore } = result.data;
        const totalProcessed = previousTotal + rawData.length;
        const isFinalBatch = !hasMore;

        // Determine the next stage in the pipeline
        const nextStage = flowResolver.getNextStage(
            "sync",
            entityType,
            this.integrationType
        );
        if (!nextStage) {
            Debug.error({
                module: "BaseAdapter",
                context: "handleJob",
                message: `No next stage found for ${entityType} in ${this.integrationType}`,
            });
            return;
        }

        // Publish fetched event with pagination metadata
        const eventName = buildEventName(nextStage, entityType);
        const fetchedEvent: FetchedEventPayload = {
            eventID: syncEvent.eventID,
            tenantID: syncEvent.tenantID,
            integrationID: syncEvent.integrationID,
            integrationType: this.integrationType,
            dataSourceID: syncEvent.dataSourceID,
            entityType: entityType,
            stage: "fetched",
            createdAt: Date.now(),
            parentEventID: syncEvent.eventID,

            data: rawData,
            total: rawData.length,
            hasMore: !isFinalBatch,
            syncMetadata: {
                syncId,
                batchNumber,
                isFinalBatch,
                cursor: nextCursor,
            },
        };

        try {
            await natsClient.publish(eventName, fetchedEvent);

            Debug.log({
                module: "BaseAdapter",
                context: "handleJob",
                message: `Published ${eventName} event with ${rawData.length} entities (batch ${batchNumber}, total: ${totalProcessed})`,
            });
        } catch (err) {
            Debug.error({
                module: "BaseAdapter",
                context: "handleJob",
                message: `Failed to publish: ${err}`,
            });
            return;
        }

        // Handle pagination
        if (hasMore && nextCursor) {
            // Schedule next batch
            await Scheduler.scheduleNextBatch(
                job,
                nextCursor,
                syncId,
                batchNumber,
                totalProcessed
            );
            await Scheduler.completeJob(job); // Complete current batch
            Debug.log({
                module: "BaseAdapter",
                context: "handleJob",
                message: `Scheduled next batch ${batchNumber + 1} (syncId: ${syncId})`,
            });
        } else {
            // Final batch - complete job and update data source
            // Note: Cleanup now handled by CleanupWorker after linked stage
            await Scheduler.completeJob(job, dataSource, `sync.${entityType}`);
            await client.mutation(api.helpers.orm.update_s, {
                tableName: "data_sources",
                data: [{
                    id: dataSource._id,
                    updates: {
                        currentSyncId: undefined,
                    },
                }],
                secret: process.env.CONVEX_API_KEY!,
            });
            Debug.log({
                module: "BaseAdapter",
                context: "handleJob",
                message: `Sync completed: ${totalProcessed} total entities processed (syncId: ${syncId})`,
            });
        }
    }

    protected abstract getRawData(
        props: RawDataProps
    ): Promise<APIResponse<RawDataResult>>;
}
