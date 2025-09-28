import Debug from "@workspace/shared/lib/Debug.js";
import { natsClient } from "@workspace/pipeline/helpers/nats.js";
import { insertRows, updateRow } from "@workspace/shared/lib/db/orm.js";

export abstract class BaseWorker {
  protected entityType: string;

  constructor(entityType: string) {
    this.entityType = entityType;
  }

  async start(): Promise<void> {
    const topic = `${this.entityType}.linked`;
    await natsClient.subscribe(topic, this.handleWork.bind(this));
    Debug.log({
      module: "BaseWorker",
      context: this.constructor.name,
      message: `Started, listening to ${topic}`,
    });
  }

  private async handleWork(data: any): Promise<void> {
    const {
      entityId,
      integrationId,
      tenantId,
      resolvedData,
      relationshipCount,
    } = data;

    try {
      Debug.log({
        module: "BaseWorker",
        context: this.constructor.name,
        message: `Processing entity ${entityId}`,
      });

      // Execute business logic using abstract method
      await this.executeBusinessLogic(
        resolvedData,
        tenantId,
        entityId,
        relationshipCount
      );

      // Mark entity processing as complete by updating its status
      await this.markEntityComplete(entityId);

      Debug.log({
        module: "BaseWorker",
        context: this.constructor.name,
        message: `Completed entity ${entityId}`,
      });
    } catch (error) {
      Debug.error({
        module: "BaseWorker",
        context: this.constructor.name,
        message: `Failed for entity ${entityId}`,
        code: "WORKER_FAILED",
      });
      await this.logError("worker", entityId, error, tenantId);
    }
  }

  // Abstract method that must be implemented by concrete workers
  protected abstract executeBusinessLogic(
    resolvedData: any,
    tenantId: string,
    entityId: string,
    relationshipCount: number
  ): Promise<void>;

  // Helper method to log events for tracking and alerting
  protected async logEvent(
    entityId: string,
    tenantId: string,
    eventType: string,
    payload: any,
    status: "pending" | "completed" | "failed" = "completed"
  ): Promise<void> {
    await insertRows("events_log", {
      rows: [
        {
          entity_id: entityId,
          tenant_id: tenantId,
          event_type: eventType,
          payload,
          processed_at: new Date().toISOString(),
          status,
        },
      ],
    });
  }

  private async markEntityComplete(entityId: string): Promise<void> {
    // Add a processing status field to the entity to track completion
    // This assumes you might want to add a status field to entities table
    const { error } = await updateRow("entities", {
      row: {
        updated_at: new Date().toISOString(),
        // Uncomment if you add a processing_status field to entities table
        // processing_status: 'completed'
      },
      id: entityId,
    });

    if (error) {
      throw new Error(`Failed to mark entity complete: ${error.message}`);
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
