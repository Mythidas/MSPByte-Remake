import Debug from "@workspace/shared/lib/Debug.js";
import { natsClient } from "@workspace/pipeline/helpers/nats.js";
import { api } from "@workspace/database/convex/_generated/api.js";
import { client } from "@workspace/shared/lib/convex.js";

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
    await client.mutation(api.events_log.crud_s.create, {
      entityId: entityId as any,
      tenantId: tenantId as any,
      eventType,
      payload,
      processedAt: Date.now(),
      status,
      secret: process.env.CONVEX_API_KEY!,
    });
  }

  private async markEntityComplete(entityId: string): Promise<void> {
    // Add a processing status field to the entity to track completion
    // This assumes you might want to add a status field to entities table
    await client.mutation(api.entities.crud_s.update, {
      id: entityId as any,
      updates: {
        // Uncomment if you add a processing_status field to entities table
        // processingStatus: 'completed'
      },
      secret: process.env.CONVEX_API_KEY!,
    });
  }

  private async logError(
    stage: string,
    entityId: string,
    error: any,
    tenantId: string
  ): Promise<void> {
    await client.mutation(api.events_log.crud_s.create, {
      entityId: entityId as any,
      tenantId: tenantId as any,
      eventType: "pipeline_error",
      payload: {
        stage,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      processedAt: Date.now(),
      status: "failed",
      secret: process.env.CONVEX_API_KEY!,
    });
  }
}
