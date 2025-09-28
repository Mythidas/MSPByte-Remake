import { natsClient } from "@workspace/pipeline/helpers/nats";
import { getRows, upsertRows } from "@workspace/shared/lib/db/orm";
import Debug from "@workspace/shared/lib/Debug";
import { APIResponse } from "@workspace/shared/types/api";
import { Tables, TablesInsert } from "@workspace/shared/types/database";
import {
  Company,
  Endpoint,
  Group,
  Identity,
} from "@workspace/shared/types/database/normalized";
import {
  EntityType,
  IntegrationType,
  FetchedEventPayload,
  ProcessedEventPayload,
  FailedEventPayload,
  DataFetchPayload,
  buildEventName,
  flowResolver,
} from "@workspace/shared/types/pipeline";

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
  ) {
    return await getRows("entities", {
      filters: [
        ["integration_id", "eq", integrationID],
        ["tenant_id", "eq", tenantID],
        ["entity_type", "eq", type],
      ],
    });
  }

  private filterChangedData(
    rawData: DataFetchPayload[],
    existingData: Tables<"entities">[]
  ) {
    return rawData.filter((data) => {
      const existing = existingData.find(
        (row) => row.external_id === data.externalID
      );
      return existing?.data_hash !== data.dataHash;
    });
  }

  private async storeEntities(
    tenantID: string,
    dataSourceID: string,
    integrationID: string,
    entityType: EntityType,
    normalized: ProcessedEntityData<T>[]
  ): Promise<APIResponse<Tables<"entities">[]>> {
    const records = normalized.map((row) => {
      return {
        tenant_id: tenantID,
        integration_id: integrationID,
        data_source_id: dataSourceID,
        external_id: row.externalID,
        site_id: row.siteID,

        entity_type: entityType,
        data_hash: row.hash,

        normalized_data: row.normalized as any,
        raw_data: row.raw,
      } as TablesInsert<"entities">;
    });

    return await upsertRows("entities", {
      rows: records,
      onConflict: [
        "tenant_id",
        "entity_type",
        "integration_id",
        "external_id",
        "data_source_id",
      ],
    });
  }

  private async publishProcessedEvent(
    originalEvent: FetchedEventPayload,
    storedEntities: Tables<"entities">[],
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
      createdAt: new Date().toISOString(),
      parentEventID: originalEvent.eventID,

      entityIDs: storedEntities.map((e) => e.id),
      entitiesCreated: storedEntities.filter(
        (e) => e.created_at === e.updated_at
      ).length,
      entitiesUpdated: storedEntities.filter(
        (e) => e.created_at !== e.updated_at
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
      createdAt: new Date().toISOString(),
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
