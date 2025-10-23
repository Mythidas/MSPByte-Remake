import Debug from "@workspace/shared/lib/Debug.js";
import { natsClient } from "@workspace/pipeline/helpers/nats.js";

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
      message: `Started, listening to ${topic}`,
    });
  }

  private async handleResolving(data: any): Promise<void> {
    const { entityId, integrationId, tenantId, normalizedData } = data;

    try {
      Debug.log({
        module: "BaseResolver",
        context: this.constructor.name,
        message: `Resolving entity ${entityId}`,
      });

      // Resolve data using abstract method
      const resolvedData = await this.resolveData(
        normalizedData,
        tenantId,
        entityId
      );

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
        message: `Completed entity ${entityId}`,
      });
    } catch (error) {
      Debug.error({
        module: "BaseResolver",
        context: this.constructor.name,
        message: `Failed for entity ${entityId}`,
      });
    }
  }

  // Abstract method that must be implemented by concrete resolvers
  protected abstract resolveData(
    normalizedData: any,
    tenantId: string,
    entityId: string
  ): Promise<any>;
}
