import { natsClient } from "@workspace/pipeline/shared/nats";
import { insertRows, updateRow } from "@workspace/shared/lib/db/orm";
import Debug from "@workspace/shared/lib/Debug";

export abstract class BaseProcessor {
  protected entityType: string;

  constructor(entityType: string) {
    this.entityType = entityType;
  }

  async start(): Promise<void> {
    const topic = `${this.entityType}.fetched`;
    await natsClient.subscribe(topic, this.handleProcessing.bind(this));
    Debug.log({
      module: "BaseProcessor",
      context: this.constructor.name,
      message: `Started, listening to ${topic}`
    });
  }

  private async handleProcessing(data: any): Promise<void> {
    const { entityId, integrationId, tenantId, rawData } = data;

    try {
      Debug.log({
        module: "BaseProcessor",
        context: this.constructor.name,
        message: `Processing entity ${entityId}`
      });

      // Normalize the raw data using abstract method
      const normalizedData = await this.normalizeData(rawData, tenantId);

      // Update entity with normalized data
      await this.storeNormalizedData(entityId, normalizedData);

      // Publish to next stage
      await natsClient.publish(`${this.entityType}.processed`, {
        entityId,
        integrationId,
        tenantId,
        normalizedData,
      });

      Debug.log({
        module: "BaseProcessor",
        context: this.constructor.name,
        message: `Completed entity ${entityId}`
      });
    } catch (error) {
      Debug.error({
        module: "BaseProcessor",
        context: this.constructor.name,
        message: `Failed for entity ${entityId}`,
        code: "PROCESSOR_FAILED"
      });
      await this.logError("processor", entityId, error, tenantId);
    }
  }

  // Abstract method that must be implemented by concrete processors
  protected abstract normalizeData(
    rawData: any,
    tenantId: string
  ): Promise<any>;

  private async storeNormalizedData(
    entityId: string,
    normalizedData: any
  ): Promise<void> {
    const { error } = await updateRow("entities", {
      row: {
        normalized_data: normalizedData,
        updated_at: new Date().toISOString(),
      },
      id: entityId,
    });

    if (error) {
      throw new Error(`Failed to store normalized data: ${error.message}`);
    }
  }

  private async logError(
    stage: string,
    entityId: string,
    error: any,
    tenantId: string
  ): Promise<void> {
    await insertRows("events_log", {
      rows: [
        {
          entity_id: entityId,
          tenant_id: tenantId,
          event_type: "pipeline_error",
          payload: {
            stage,
            error: error instanceof Error ? error.message : "Unknown error",
          },
          processed_at: new Date().toISOString(),
          status: "failed",
        },
      ],
    });
  }
}