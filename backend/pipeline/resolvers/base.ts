import Debug from "@workspace/shared/lib/Debug";
import { natsClient } from "@workspace/pipeline/shared/nats";
import { getRows, updateRow, insertRows } from "@workspace/shared/lib/db/orm";

export abstract class BaseResolver {
  protected entityType: string;

  constructor(entityType: string) {
    this.entityType = entityType;
  }

  async start(): Promise<void> {
    const topic = `${this.entityType}.processed`;
    await natsClient.subscribe(topic, this.handleResolving.bind(this));
    Debug.log({
      module: "BaseResolver",
      context: this.constructor.name,
      message: `Started, listening to ${topic}`
    });
  }

  private async handleResolving(data: any): Promise<void> {
    const { entityId, integrationId, tenantId, normalizedData } = data;

    try {
      Debug.log({
        module: "BaseResolver",
        context: this.constructor.name,
        message: `Resolving entity ${entityId}`
      });

      // Resolve data using abstract method
      const resolvedData = await this.resolveData(
        normalizedData,
        tenantId,
        entityId
      );

      // Update entity with resolved data
      await this.storeResolvedData(entityId, resolvedData);

      // Publish to next stage
      await natsClient.publish(`${this.entityType}.resolved`, {
        entityId,
        integrationId,
        tenantId,
        resolvedData,
      });

      Debug.log({
        module: "BaseResolver",
        context: this.constructor.name,
        message: `Completed entity ${entityId}`
      });
    } catch (error) {
      Debug.error({
        module: "BaseResolver",
        context: this.constructor.name,
        message: `Failed for entity ${entityId}`,
        code: "RESOLVER_FAILED"
      });
      await this.logError("resolver", entityId, error, tenantId);
    }
  }

  // Abstract method that must be implemented by concrete resolvers
  protected abstract resolveData(
    normalizedData: any,
    tenantId: string,
    entityId: string
  ): Promise<any>;

  // Helper method for finding related entities
  protected async findRelatedEntities(
    tenantId: string,
    entityType: string,
    searchField: string,
    searchValue: any
  ): Promise<any[]> {
    const { data, error } = await getRows("entities", {
      filters: [
        ["tenant_id", "eq", tenantId],
        ["entity_type", "eq", entityType],
      ],
    });

    if (error || !data) {
      return [];
    }

    // Filter by normalized_data field (this is a simplified approach)
    return data.rows.filter((entity) => {
      const normalized = entity.normalized_data as any;
      return normalized && normalized[searchField] === searchValue;
    });
  }

  private async storeResolvedData(
    entityId: string,
    resolvedData: any
  ): Promise<void> {
    const { error } = await updateRow("entities", {
      row: {
        normalized_data: resolvedData,
        updated_at: new Date().toISOString(),
      },
      id: entityId,
    });

    if (error) {
      throw new Error(`Failed to store resolved data: ${error.message}`);
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
