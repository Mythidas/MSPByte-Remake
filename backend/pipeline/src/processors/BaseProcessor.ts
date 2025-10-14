import { natsClient } from "@workspace/pipeline/helpers/nats.js";
import { api } from "@workspace/database/convex/_generated/api.js";
import type { Doc } from "@workspace/database/convex/_generated/dataModel.js";
import type {
  Company,
  Endpoint,
  Group,
  Identity,
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

      const changedData = this.filterChangedData(data, existingData.data.rows);
      const normalizedData = this.normalizeData(integrationType, changedData);

      const stored = await this.storeEntities(
        tenantID,
        dataSourceID,
        integrationID,
        entityType,
        normalizedData
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
          normalizedData.length
        );
      }
    } catch (error) {
      Debug.error({
        module: "BaseProcessor",
        context: "handleProcessing",
        message: `Failed for event ${eventID} (${entityType} | ${integrationID}): ${error}`,
        code: "PROCESSOR_FAILED",
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
    type: EntityType
  ): Promise<APIResponse<{ rows: Doc<"entities">[] }>> {
    try {
      const entities = await client.query(api.entities.crud.list_s, {
        tenantId: tenantID as any,
        secret: process.env.CONVEX_API_KEY!,
        filter: {
          by_integration_type: {
            integrationId: integrationID as any,
            entityType: type,
          },
        },
      });
      return { data: { rows: entities } };
    } catch (error) {
      return {
        error: {
          module: "BaseProcessor",
          context: "getExistingData",
          code: "DB_FAILURE",
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
    normalized: ProcessedEntityData<T>[]
  ): Promise<APIResponse<Doc<"entities">[]>> {
    try {
      const storedEntities: Doc<"entities">[] = [];

      for (const row of normalized) {
        // Check if entity exists using the unique constraint fields
        const existing = await client.query(api.entities.crud.get_s, {
          tenantId: tenantID as any,
          secret: process.env.CONVEX_API_KEY!,
          filters: {
            by_external_id: {
              externalId: row.externalID,
            },
          },
        });

        let entity: Doc<"entities">;
        if (existing) {
          // Update existing entity
          entity = (await client.mutation(api.entities.crud.update_s, {
            id: existing._id,
            updates: {
              dataHash: row.hash,
              normalizedData: row.normalized as any,
              rawData: row.raw,
            },
            secret: process.env.CONVEX_API_KEY!,
          }))!;
        } else {
          // Create new entity
          entity = (await client.mutation(api.entities.crud.create_s, {
            secret: process.env.CONVEX_API_KEY!,
            tenantId: tenantID as any,
            data: {
              integrationId: integrationID as any,
              dataSourceId: dataSourceID as any,
              externalId: row.externalID,
              siteId: row.siteID as any,
              entityType: entityType,
              dataHash: row.hash,
              normalizedData: row.normalized as any,
              rawData: row.raw,
            },
          }))!;
        }

        storedEntities.push(entity);
      }

      return { data: storedEntities };
    } catch (error) {
      return {
        error: {
          module: "BaseProcessor",
          context: "getExistingData",
          code: "DB_FAILURE",
          message: error instanceof Error ? error.message : "Unknown error",
          time: new Date().toISOString(),
        },
      };
    }
  }

  private async publishProcessedEvent(
    originalEvent: FetchedEventPayload,
    storedEntities: Doc<"entities">[],
    totalProcessed: number
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

      entityIDs: storedEntities.map((e) => e._id),
      entitiesCreated: storedEntities.filter(
        (e) => e._creationTime === e.updatedAt
      ).length,
      entitiesUpdated: storedEntities.filter(
        (e) => e._creationTime !== e.updatedAt
      ).length,
      entitiesSkipped: originalEvent.total - totalProcessed,
    };

    const eventName = buildEventName("processed", originalEvent.entityType);

    try {
      await natsClient.publish(eventName, processedEvent);
      Debug.log({
        module: "BaseProcessor",
        context: "publishProcessedEvent",
        message: `Published ${eventName} event with ${storedEntities.length} entities`,
      });
    } catch (err) {
      Debug.error({
        module: "BaseProcessor",
        context: "publishProcessedEvent",
        message: `Failed to publish ${eventName}: ${err}`,
        code: "NATS_FAILURE",
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
        code: errorCode,
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
        code: "NATS_FAILURE",
      });
    }
  }
}
