import Debug from "@workspace/shared/lib/Debug";
import { natsClient } from "@workspace/pipeline/shared/nats";
import { insertRows } from "@workspace/shared/lib/db/orm";

interface LinkerDependency {
  entityType: string;
  topic: string;
}

interface PendingLinkage {
  entityId: string;
  integrationId: string;
  tenantId: string;
  resolvedData: any;
  receivedTopics: Set<string>;
  timestamp: number;
}

export abstract class BaseLinker {
  protected entityType: string;
  protected dependencies: LinkerDependency[];
  private pendingLinkages = new Map<string, PendingLinkage>();
  private readonly TIMEOUT_MS = 300000; // 5 minutes

  constructor(entityType: string, dependencies: LinkerDependency[] = []) {
    this.entityType = entityType;
    this.dependencies = dependencies;
  }

  async start(): Promise<void> {
    // Subscribe to all dependency topics
    if (this.dependencies.length > 0) {
      for (const dependency of this.dependencies) {
        await natsClient.subscribe(
          dependency.topic,
          this.handleDependency.bind(this, dependency.topic)
        );
        Debug.log({
          module: "BaseLinker",
          context: this.constructor.name,
          message: `Subscribed to dependency: ${dependency.topic}`
        });
      }
    } else {
      // If no dependencies, subscribe directly to resolved topic
      const topic = `${this.entityType}.resolved`;
      await natsClient.subscribe(topic, this.handleLinking.bind(this));
      Debug.log({
        module: "BaseLinker",
        context: this.constructor.name,
        message: `Started, listening to ${topic}`
      });
    }

    // Clean up expired pending linkages every minute
    setInterval(() => this.cleanupExpired(), 60000);
  }

  private async handleDependency(topic: string, data: any): Promise<void> {
    const { entityId, tenantId } = data;

    // Create or update pending linkage
    let pending = this.pendingLinkages.get(entityId);
    if (!pending) {
      pending = {
        entityId,
        integrationId: data.integrationId,
        tenantId,
        resolvedData: data.resolvedData,
        receivedTopics: new Set(),
        timestamp: Date.now(),
      };
      this.pendingLinkages.set(entityId, pending);
    }

    pending.receivedTopics.add(topic);

    // Check if all dependencies are satisfied
    const requiredTopics = new Set(this.dependencies.map((d) => d.topic));
    const hasAllDependencies = [...requiredTopics].every((topic) =>
      pending.receivedTopics.has(topic)
    );

    if (hasAllDependencies) {
      // All dependencies satisfied, proceed with linking
      this.pendingLinkages.delete(entityId);
      await this.handleLinking(data);
    }
  }

  private async handleLinking(data: any): Promise<void> {
    const { entityId, integrationId, tenantId, resolvedData } = data;

    try {
      Debug.log({
        module: "BaseLinker",
        context: this.constructor.name,
        message: `Linking entity ${entityId}`
      });

      // Create relationships using abstract method
      const relationships = await this.analyzeAndCreateRelationships(
        resolvedData,
        tenantId,
        entityId
      );

      // Store relationships in database
      if (relationships.length > 0) {
        await this.storeRelationships(relationships, tenantId);
      }

      // Publish to next stage
      await natsClient.publish(`${this.entityType}.linked`, {
        entityId,
        integrationId,
        tenantId,
        resolvedData,
        relationshipCount: relationships.length,
      });

      Debug.log({
        module: "BaseLinker",
        context: this.constructor.name,
        message: `Completed entity ${entityId}, created ${relationships.length} relationships`
      });
    } catch (error) {
      Debug.error({
        module: "BaseLinker",
        context: this.constructor.name,
        message: `Failed for entity ${entityId}`,
        code: "LINKER_FAILED"
      });
      await this.logError("linker", entityId, error, tenantId);
    }
  }

  // Abstract method that must be implemented by concrete linkers
  protected abstract analyzeAndCreateRelationships(
    resolvedData: any,
    tenantId: string,
    entityId: string
  ): Promise<
    Array<{
      parent_entity_id: string;
      child_entity_id: string;
      relationship_type: string;
      metadata?: any;
    }>
  >;

  private async storeRelationships(
    relationships: any[],
    tenantId: string
  ): Promise<void> {
    const relationshipsToInsert = relationships.map((rel) => ({
      ...rel,
      tenant_id: tenantId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    const { error } = await insertRows("entity_relationships", {
      rows: relationshipsToInsert,
    });

    if (error) {
      throw new Error(`Failed to create relationships: ${error.message}`);
    }

    Debug.log({
      module: "BaseLinker",
      context: "storeRelationships",
      message: `Created ${relationships.length} entity relationships`
    });
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

  private cleanupExpired(): void {
    const now = Date.now();
    for (const [entityId, pending] of this.pendingLinkages.entries()) {
      if (now - pending.timestamp > this.TIMEOUT_MS) {
        Debug.log({
          module: "BaseLinker",
          context: "cleanupExpired",
          message: `Cleaning up expired pending linkage for entity ${entityId}`
        });
        this.pendingLinkages.delete(entityId);
      }
    }
  }
}
