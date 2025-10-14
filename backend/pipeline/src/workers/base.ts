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
    }
  }

  // Abstract method that must be implemented by concrete workers
  protected abstract executeBusinessLogic(
    resolvedData: any,
    tenantId: string,
    entityId: string,
    relationshipCount: number
  ): Promise<void>;

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
}
