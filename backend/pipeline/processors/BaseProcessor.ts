import { natsClient } from "@workspace/pipeline/shared/nats";
import {
  getRows,
  insertRows,
  updateRow,
  upsertRows,
} from "@workspace/shared/lib/db/orm";
import Debug from "@workspace/shared/lib/Debug";
import { EventPayload } from "@workspace/shared/types/events";
import { DataFetchPayload } from "@workspace/shared/types/events/data-event";
import { Company } from "@workspace/shared/types/database/normalized";
import { APIResponse } from "@workspace/shared/types/api";
import { EntityTypes } from "@workspace/shared/types/database/entity";
import { Tables, TablesInsert } from "@workspace/shared/types/database";

export type CompanyData = {
  normalized: Company;
  raw: any;
  hash: string;
};

export abstract class BaseProcessor {
  protected entityType: EntityTypes;

  constructor(entityType: EntityTypes) {
    this.entityType = entityType;
  }

  async start(): Promise<void> {
    const topic = `${this.entityType}.fetched`;
    await natsClient.subscribe(topic, this.handleProcessing.bind(this));
    Debug.log({
      module: "BaseProcessor",
      context: this.constructor.name,
      message: `Started, listening to ${topic}`,
    });
  }

  private async handleProcessing(
    eventData: EventPayload<"*.fetched">
  ): Promise<void> {
    const { eventID, tenantID, integrationID, dataSourceID, entityType, data } =
      eventData;

    try {
      Debug.log({
        module: "BaseProcessor",
        context: this.constructor.name,
        message: `Processing event ${eventID} (${entityType} | ${integrationID})`,
      });

      // Normalize the raw data using abstract method
      const existingData = await this.getExistingData(
        integrationID,
        tenantID,
        "companies"
      );
      if (existingData.error) {
        Debug.error({
          module: "BaseProcessor",
          context: "handleProcessing",
          message: `Failed to fetch existing data: ${existingData.error.message} (${entityType} | ${integrationID})`,
          code: "DB_FAILURE",
        });
        return;
      }

      const changedData = this.filterChangedData(data, existingData.data.rows);
      const normalizedData = this.normalizeData(integrationID, changedData);

      const stored = await this.storeEntities(
        tenantID,
        dataSourceID,
        integrationID,
        normalizedData
      );

      if (stored.error) {
        Debug.error({
          module: "BaseProcessor",
          context: "handleProcessing",
          message: `Failed to store entites: ${stored.error.message}`,
          code: "DB_FAILURE",
        });
      }

      // TODO: Publish NATS event
    } catch (error) {
      Debug.error({
        module: "BaseProcessor",
        context: "handleProcessing",
        message: `Failed for event ${eventID} (${entityType} | ${integrationID})`,
        code: "PROCESSOR_FAILED",
      });
    }
  }

  // Abstract method that must be implemented by concrete processors
  protected abstract normalizeData(
    integrationID: string,
    data: DataFetchPayload[]
  ): CompanyData[];

  private async getExistingData(
    integrationID: string,
    tenantID: string,
    type: EntityTypes
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
    normalized: CompanyData[]
  ): Promise<APIResponse<Tables<"entities">[]>> {
    const records = normalized.map((row) => {
      return {
        tenant_id: tenantID,
        integration_id: integrationID,
        data_source_id: dataSourceID,
        external_id: row.normalized.external_id,

        entity_type: "company",
        data_hash: row.hash,

        normalized_data: row.normalized as any,
        raw_data: row.raw,
      } as TablesInsert<"entities">;
    });

    return await upsertRows("entities", {
      rows: records,
      onConlfict: [
        "tenant_id",
        "entity_type",
        "integration_id",
        "external_id",
        "data_source_id",
      ],
    });
  }
}
