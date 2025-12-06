import { BaseWorker } from "@workspace/pipeline/workers/BaseWorker.js";
import { api } from "@workspace/database/convex/_generated/api.js";
import type { Doc, Id } from "@workspace/database/convex/_generated/dataModel.js";
import { client } from "@workspace/shared/lib/convex.js";
import Debug from "@workspace/shared/lib/Debug.js";
import type { LinkedEventPayload } from "@workspace/shared/types/pipeline/index.js";

/**
 * CleanupWorker - Handles soft deletion of entities not seen in sync
 *
 * This worker runs after the linked stage to ensure all processing is complete
 * before marking entities as deleted. It implements the mark-and-sweep algorithm:
 *
 * 1. During sync: Processor marks all seen entities with current syncId
 * 2. After sync complete (final batch): This worker soft-deletes entities with old syncId
 *
 * Features:
 * - Runs only on final batch (requiresFullContext = true)
 * - Executes after all processing stages complete (subscribes to linked events)
 * - Uses 90-day soft delete (entities retained for audit/recovery)
 */
export class CleanupWorker extends BaseWorker {
    constructor() {
        // Subscribe to all entity types that need cleanup
        super(["identities", "groups", "roles", "policies", "licenses"]);

        // Only run on final batch to ensure all entities have been processed
        this.requiresFullContext = true;
    }

    /**
     * Execute cleanup after linked stage completes
     */
    protected async execute(event: LinkedEventPayload): Promise<void> {
        if (!event.syncMetadata) {
            Debug.log({
                module: "CleanupWorker",
                context: "execute",
                message: `Skipping cleanup - no syncMetadata (non-paginated sync or old event format)`,
            });
            return;
        }

        const { syncId } = event.syncMetadata;
        const { dataSourceID, entityType } = event;

        Debug.log({
            module: "CleanupWorker",
            context: "execute",
            message: `Starting cleanup for ${entityType} (dataSource: ${dataSourceID}, syncId: ${syncId})`,
        });

        await this.cleanupDeletedEntities(
            dataSourceID,
            syncId,
            entityType
        );
    }

    /**
     * Mark-and-sweep deletion: Mark entities as deleted if they weren't seen in current sync
     * This is the core deletion detection logic for cursor-based pagination
     */
    private async cleanupDeletedEntities(
        dataSourceID: string,
        syncId: string,
        entityType: string
    ): Promise<void> {
        try {
            // Query entities for this data source and type that don't have current syncId
            // These are entities that existed before but weren't seen in the current sync
            const entities = (await client.query(api.helpers.orm.list_s, {
                tableName: "entities",
                secret: process.env.CONVEX_API_KEY!,
                index: {
                    name: "by_data_source_type",
                    params: {
                        dataSourceId: dataSourceID as any,
                        entityType: entityType as any,
                    },
                },
            })) as Doc<"entities">[];

            // Filter for entities that weren't seen in this sync (different syncId or no syncId)
            // AND are not already soft deleted
            const entitiesToDelete = entities.filter((entity) => {
                const hasWrongSyncId = entity.syncId !== syncId;
                const notAlreadyDeleted = !entity.deletedAt;
                return hasWrongSyncId && notAlreadyDeleted;
            });

            if (entitiesToDelete.length === 0) {
                Debug.log({
                    module: "CleanupWorker",
                    context: "cleanupDeletedEntities",
                    message: `No entities to soft delete for ${entityType} (syncId: ${syncId})`,
                });
                return;
            }

            // Soft delete entities by setting deletedAt timestamp
            const now = Date.now();
            const updates = entitiesToDelete.map((entity) => ({
                id: entity._id,
                updates: {
                    deletedAt: now,
                },
            }));

            await client.mutation(api.helpers.orm.update_s, {
                tableName: "entities",
                data: updates,
                secret: process.env.CONVEX_API_KEY!,
            });

            Debug.log({
                module: "CleanupWorker",
                context: "cleanupDeletedEntities",
                message: `Soft deleted ${entitiesToDelete.length} ${entityType} entities (syncId: ${syncId})`,
            });
        } catch (error) {
            Debug.error({
                module: "CleanupWorker",
                context: "cleanupDeletedEntities",
                message: `Failed to cleanup deleted entities: ${error}`,
            });
            // Don't throw - deletion cleanup failure shouldn't fail the entire sync
        }
    }
}
