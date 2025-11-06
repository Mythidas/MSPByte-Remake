import { natsClient } from "@workspace/pipeline/helpers/nats.js";
import { api } from "@workspace/database/convex/_generated/api.js";
import type {
    Doc,
    Id,
} from "@workspace/database/convex/_generated/dataModel.js";
import type {
    Company,
    Endpoint,
    Firewall,
    Group,
    Identity,
    Role,
    Policy,
    License
} from "@workspace/database/convex/types/normalized.js";
import Debug from "@workspace/shared/lib/Debug.js";
import { APIResponse } from "@workspace/shared/types/api.js";
import {
    EntityType,
    IntegrationType,
    FetchedEventPayload,
    ProcessedEventPayload,
    FailedEventPayload,
    DataFetchPayload,
    buildEventName,
    flowResolver,
} from "@workspace/shared/types/pipeline/index.js";
import { client } from "@workspace/shared/lib/convex.js";

export interface ProcessedEntityData<T = any> {
    normalized: T;
    raw: any;
    hash: string;
    externalID: string;
    siteID?: string;
}

export type CompanyData = ProcessedEntityData<Company>;
export type EndpointData = ProcessedEntityData<Endpoint>;
export type IdentityData = ProcessedEntityData<Identity>;
export type GroupData = ProcessedEntityData<Group>;
export type FirewallData = ProcessedEntityData<Firewall>;
export type RoleData = ProcessedEntityData<Role>;
export type PolicyData = ProcessedEntityData<Policy>;
export type LicenseData = ProcessedEntityData<License>;

export abstract class BaseProcessor<T = any> {
    protected entityType: EntityType;
    protected integrationType?: IntegrationType;

    constructor(entityType: EntityType, integrationType?: IntegrationType) {
        this.entityType = entityType;
        this.integrationType = integrationType;
    }

    async start(): Promise<void> {
        const topic = buildEventName("fetched", this.entityType);
        await natsClient.subscribe(topic, this.handleProcessing.bind(this));
        Debug.log({
            module: "BaseProcessor",
            context: this.constructor.name,
            message: `Started, listening to ${topic}`,
        });
    }

    private async handleProcessing(
        fetchedEvent: FetchedEventPayload
    ): Promise<void> {
        const {
            eventID,
            tenantID,
            integrationID,
            integrationType,
            dataSourceID,
            entityType,
            data,
        } = fetchedEvent;

        try {
            Debug.log({
                module: "BaseProcessor",
                context: this.constructor.name,
                message: `Processing event ${eventID} (${entityType} | ${integrationID})`,
            });

            const existingData = await this.getExistingData(
                integrationID,
                tenantID,
                dataSourceID,
                entityType
            );
            if (existingData.error) {
                await this.publishFailedEvent(
                    fetchedEvent,
                    `Failed to fetch existing data: ${existingData.error.message}`,
                    "DB_FAILURE"
                );
                return;
            }

            // Normalize ALL data (not just changed) to ensure syncId updates for all entities
            const normalizedData = this.normalizeData(integrationType, data);

            // Extract syncId from fetchedEvent (use syncId for mark-and-sweep deletion)
            const syncId = fetchedEvent.syncMetadata?.syncId;

            const stored = await this.storeEntities(
                tenantID,
                dataSourceID,
                integrationID,
                entityType,
                normalizedData,
                existingData.data.rows, // Pass existing data to compare hashes
                syncId
            );

            if (stored.error) {
                await this.publishFailedEvent(
                    fetchedEvent,
                    `Failed to store entities: ${stored.error.message}`,
                    "DB_FAILURE"
                );
                return;
            }

            const nextStage = flowResolver.getNextStage(
                "processed",
                entityType,
                integrationType
            );
            if (nextStage) {
                await this.publishProcessedEvent(
                    fetchedEvent,
                    stored.data,
                    normalizedData.length,
                    fetchedEvent.syncMetadata
                );
            }
        } catch (error) {
            Debug.error({
                module: "BaseProcessor",
                context: "handleProcessing",
                message: `Failed for event ${eventID} (${entityType} | ${integrationID}): ${error}`,
            });

            await this.publishFailedEvent(
                fetchedEvent,
                `Processing failed: ${error}`,
                "PROCESSOR_FAILED"
            );
        }
    }

    // Abstract method that must be implemented by concrete processors
    protected abstract normalizeData(
        integrationType: IntegrationType,
        data: DataFetchPayload[]
    ): ProcessedEntityData<T>[];

    private async getExistingData(
        integrationID: string,
        tenantID: string,
        dataSourceId: string,
        type: EntityType
    ): Promise<APIResponse<{ rows: Doc<"entities">[] }>> {
        try {
            const entities = (await client.query(api.helpers.orm.list_s, {
                tableName: "entities",
                tenantId: tenantID as any,
                secret: process.env.CONVEX_API_KEY!,
                index: {
                    name: "by_integration_type",
                    params: {
                        integrationId: integrationID as any,
                        entityType: type,
                    },
                },
                filters: {
                    dataSourceId: dataSourceId as any
                }
            })) as Doc<"entities">[];
            return { data: { rows: entities } };
        } catch (error) {
            return {
                error: {
                    module: "BaseProcessor",
                    context: "getExistingData",

                    message: error instanceof Error ? error.message : "Unknown error",
                    time: new Date().toISOString(),
                },
            };
        }
    }

    private filterChangedData(
        rawData: DataFetchPayload[],
        existingData: Doc<"entities">[]
    ) {
        return rawData.filter((data) => {
            const existing = existingData.find(
                (row) => row.externalId === data.externalID
            );
            return existing?.dataHash !== data.dataHash;
        });
    }

    private async storeEntities(
        tenantID: string,
        dataSourceID: string,
        integrationID: string,
        entityType: EntityType,
        normalized: ProcessedEntityData<T>[],
        existingEntities: Doc<"entities">[],
        syncId?: string
    ): Promise<
        APIResponse<{
            ids: Id<"entities">[];
            created: number;
            updated: number;
        }>
    > {
        try {
            const now = Date.now();
            const updates: {
                id: Id<"entities">;
                updates: {
                    entityType?: EntityType;
                    dataHash?: string | undefined;
                    rawData?: any;
                    normalizedData?: any;
                    syncId?: string;
                    lastSeenAt?: number;
                    deletedAt?: number;
                };
            }[] = [];
            const creates: {
                siteId?: Id<"sites"> | undefined;
                integrationId: Id<"integrations">;
                externalId: string;
                dataSourceId: Id<"data_sources">;
                entityType: EntityType;
                dataHash: string;
                rawData: any;
                normalizedData: any;
                syncId?: string;
                lastSeenAt?: number;
            }[] = [];

            let actuallyUpdated = 0;

            await Promise.all(
                normalized.map(async (row) => {
                    // Find existing entity from in-memory list (faster than separate query)
                    const existing = existingEntities.find(
                        (e) => e.externalId === row.externalID
                    );

                    if (existing) {
                        // Check if data actually changed
                        const dataChanged = existing.dataHash !== row.hash;

                        // Always update sync tracking fields
                        const updatePayload: any = {
                            syncId: syncId,
                            lastSeenAt: now,
                            deletedAt: undefined, // Clear soft delete if entity is back
                        };

                        // Only update data fields if hash changed
                        if (dataChanged) {
                            updatePayload.dataHash = row.hash;
                            updatePayload.normalizedData = row.normalized as any;
                            updatePayload.rawData = row.raw;
                            actuallyUpdated++;
                        }

                        updates.push({
                            id: existing._id,
                            updates: updatePayload,
                        });
                    } else {
                        // New entity - create with all fields
                        creates.push({
                            integrationId: integrationID as any,
                            dataSourceId: dataSourceID as any,
                            externalId: row.externalID,
                            siteId: row.siteID as any,
                            entityType: entityType,
                            dataHash: row.hash,
                            normalizedData: row.normalized as any,
                            rawData: row.raw,
                            syncId: syncId,
                            lastSeenAt: now,
                        });
                    }
                })
            );

            const [updateResult, createResult] = await Promise.all([
                updates.length
                    ? client.mutation(api.helpers.orm.update_s, {
                        tableName: "entities",
                        data: updates,
                        secret: process.env.CONVEX_API_KEY!,
                    })
                    : [],
                creates.length
                    ? client.mutation(api.helpers.orm.insert_s, {
                        tableName: "entities",
                        tenantId: tenantID as any,
                        secret: process.env.CONVEX_API_KEY!,
                        data: creates,
                    })
                    : [],
            ]);

            return {
                data: {
                    ids: [
                        ...(updateResult as Id<"entities">[]),
                        ...(createResult as Id<"entities">[]),
                    ],
                    created: createResult.length,
                    updated: actuallyUpdated, // Use count of entities with data changes, not all updates
                },
            };
        } catch (error) {
            return {
                error: {
                    module: "BaseProcessor",
                    context: "getExistingData",

                    message: "Failed to create or update entities",
                    time: new Date().toISOString(),
                },
            };
        }
    }

    private async publishProcessedEvent(
        originalEvent: FetchedEventPayload,
        storedEntities: {
            ids: Id<"entities">[];
            created: number;
            updated: number;
        },
        totalProcessed: number,
        syncMetadata?: {
            syncId: string;
            batchNumber: number;
            isFinalBatch: boolean;
            cursor?: string;
        }
    ): Promise<void> {
        const processedEvent: ProcessedEventPayload = {
            eventID: originalEvent.eventID,
            tenantID: originalEvent.tenantID,
            integrationID: originalEvent.integrationID,
            integrationType: originalEvent.integrationType,
            dataSourceID: originalEvent.dataSourceID,
            entityType: originalEvent.entityType,
            stage: "processed",
            createdAt: Date.now(),
            parentEventID: originalEvent.eventID,

            entityIDs: storedEntities.ids,
            entitiesCreated: storedEntities.created,
            entitiesUpdated: storedEntities.updated,
            entitiesSkipped: originalEvent.total - totalProcessed,
            changedEntityIds: storedEntities.ids, // Track changed entities for incremental processing
            syncMetadata, // Forward syncMetadata for pagination tracking
        };

        const eventName = buildEventName("processed", originalEvent.entityType);

        try {
            await natsClient.publish(eventName, processedEvent);
            Debug.log({
                module: "BaseProcessor",
                context: "publishProcessedEvent",
                message: `Published ${eventName} event with ${storedEntities.ids.length} entities`,
            });
        } catch (err) {
            Debug.error({
                module: "BaseProcessor",
                context: "publishProcessedEvent",
                message: `Failed to publish ${eventName}: ${err}`,
            });
        }
    }

    private async publishFailedEvent(
        originalEvent: FetchedEventPayload,
        errorMessage: string,
        errorCode: string
    ): Promise<void> {
        const failedEvent: FailedEventPayload = {
            eventID: originalEvent.eventID,
            tenantID: originalEvent.tenantID,
            integrationID: originalEvent.integrationID,
            integrationType: originalEvent.integrationType,
            dataSourceID: originalEvent.dataSourceID,
            entityType: originalEvent.entityType,
            stage: "failed",
            createdAt: Date.now(),
            parentEventID: originalEvent.eventID,

            error: {
                message: errorMessage,
                retryable: errorCode !== "UNSUPPORTED_ENTITY",
            },
            failedAt: "processed",
        };

        const eventName = buildEventName("failed", originalEvent.entityType);

        try {
            await natsClient.publish(eventName, failedEvent);
        } catch (err) {
            Debug.error({
                module: "BaseProcessor",
                context: "publishFailedEvent",
                message: `Failed to publish failure event: ${err}`,
            });
        }
    }
}
