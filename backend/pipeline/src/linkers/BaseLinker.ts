import { ConvexHttpClient } from "convex/browser";
import { api } from "@workspace/database/convex/_generated/api.js";
import { Job } from "bullmq";
import { LinkJobData, QueueNames, queueManager } from "../lib/queue.js";
import { MetricsCollector } from "../lib/metrics.js";
import { Logger } from "../lib/logger.js";
import { RelationshipToCreate, LinkerResult } from "../types.js";
import type { Id } from "@workspace/database/convex/_generated/dataModel";
import type { IntegrationId } from "@workspace/shared/types/integrations";

/**
 * BaseLinker - Abstract base class for all relationship linkers
 *
 * Responsibilities:
 * 1. Subscribe to BullMQ link:{integration} queue
 * 2. Load entities from database (batched)
 * 3. Call concrete linker's link() method to determine relationships
 * 4. Batch create/update/delete relationships
 * 5. Track metrics (relationships created/updated/deleted)
 * 6. Trigger analyze stage after linking
 *
 * Relationship lifecycle:
 * - Create: New relationships discovered
 * - Update: Existing relationships with changed metadata
 * - Delete: Stale relationships not seen in current sync (mark-and-sweep)
 */
export abstract class BaseLinker {
  protected convex: ConvexHttpClient;
  protected metrics: MetricsCollector;
  protected secret: string;
  protected integrationId: IntegrationId;

  constructor(convexUrl: string, integrationId: IntegrationId) {
    this.convex = new ConvexHttpClient(convexUrl);
    this.metrics = new MetricsCollector();
    this.integrationId = integrationId;

    // Validate CONVEX_API_KEY is set
    this.secret = process.env.CONVEX_API_KEY || "";
    if (!this.secret) {
      throw new Error(
        "CONVEX_API_KEY environment variable is required for BaseLinker",
      );
    }
  }

  /**
   * Start the linker worker
   * Subscribes to link:{integration} queue
   */
  start(): void {
    const queueName = QueueNames.link(this.integrationId);

    queueManager.createWorker<LinkJobData>(
      queueName,
      this.handleLinkJob.bind(this),
      {
        concurrency: 5, // Multiple linking jobs in parallel
      },
    );

    Logger.log({
      module: "BaseLinker",
      context: "start",
      message: `${this.getLinkerName()} started worker for ${this.integrationId}`,
      level: "info",
    });
  }

  /**
   * Handle link job from queue
   */
  private async handleLinkJob(job: Job<LinkJobData>): Promise<void> {
    const {
      tenantId,
      integrationId,
      dataSourceId,
      syncId,
      siteId,
      startedAt,
      metrics: previousMetrics,
    } = job.data;

    // Restore metrics from previous stages (adapter + processor) if present
    if (previousMetrics) {
      const previous = MetricsCollector.fromJSON(previousMetrics);
      this.metrics = previous;
    } else {
      this.metrics.reset();
    }

    this.metrics.startStage("linker");

    Logger.log({
      module: "BaseLinker",
      context: "handleLinkJob",
      message: `Starting linking for datasource ${dataSourceId}`,
      level: "info",
    });

    try {
      // STEP 1: Load all entities for this datasource (batched)
      this.metrics.trackQuery();
      const entities = await this.convex.query(api.helpers.orm.list_s, {
        tableName: "entities",
        tenantId,
        secret: this.secret,
        filters: {
          dataSourceId,
        },
      });

      Logger.log({
        module: "BaseLinker",
        context: "handleLinkJob",
        message: `Loaded ${entities.length} entities`,
        level: "trace",
      });

      // STEP 2: Load existing relationships for this datasource
      this.metrics.trackQuery();
      const existingRelationships = await this.convex.query(
        api.helpers.orm.list_s,
        {
          tableName: "entity_relationships",
          tenantId,
          secret: this.secret,
          filters: {
            dataSourceId,
          },
        },
      );

      Logger.log({
        module: "BaseLinker",
        context: "handleLinkJob",
        message: `Found ${existingRelationships.length} existing relationships`,
        level: "trace",
      });

      // STEP 3: Call concrete linker to determine relationships
      const desiredRelationships = await this.link(
        entities as any[],
        dataSourceId,
      );

      Logger.log({
        module: "BaseLinker",
        context: "handleLinkJob",
        message: `Linker determined ${desiredRelationships.length} desired relationships`,
        level: "trace",
      });

      // STEP 4: Reconcile relationships (create, update, delete)
      const result = await this.reconcileRelationships(
        existingRelationships as any[],
        desiredRelationships,
        tenantId,
        integrationId,
        dataSourceId,
        syncId,
      );

      Logger.log({
        module: "BaseLinker",
        context: "handleLinkJob",
        message: `Reconciliation: ${result.relationshipsCreated} created, ${result.relationshipsUpdated} updated, ${result.relationshipsDeleted} deleted`,
        level: "info",
      });

      this.metrics.endStage("linker");

      // STEP 5: Trigger analyze stage with accumulated metrics
      await this.triggerAnalyze(
        tenantId,
        integrationId,
        dataSourceId,
        syncId,
        startedAt,
        siteId,
      );
    } catch (error) {
      this.metrics.trackError(error as Error, job.attemptsMade);
      this.metrics.endStage("linker");

      Logger.log({
        module: "BaseLinker",
        context: "handleLinkJob",
        message: `Linking failed: ${error}`,
        level: "error",
      });

      throw error; // Re-throw to trigger BullMQ retry
    }
  }

  /**
   * Determine relationships between entities
   * Must be implemented by concrete linkers
   */
  protected abstract link(
    entities: any[],
    dataSourceId: Id<"data_sources">,
  ): Promise<RelationshipToCreate[]>;

  /**
   * Get linker name for logging
   */
  protected abstract getLinkerName(): string;

  /**
   * Reconcile desired relationships with existing ones
   * Creates, updates, or deletes as needed
   */
  private async reconcileRelationships(
    existing: any[],
    desired: RelationshipToCreate[],
    tenantId: Id<"tenants">,
    integrationId: IntegrationId,
    dataSourceId: Id<"data_sources">,
    syncId: string,
  ): Promise<LinkerResult> {
    const now = Date.now();

    // Build map of existing relationships by unique key
    const existingMap = new Map<string, any>();
    for (const rel of existing) {
      const key = this.getRelationshipKey(
        rel.parentEntityId,
        rel.childEntityId,
        rel.relationshipType,
      );
      existingMap.set(key, rel);
    }

    // Build set of desired relationship keys
    const desiredKeys = new Set<string>();
    const toCreate: any[] = [];
    const toUpdate: any[] = [];

    for (const rel of desired) {
      const key = this.getRelationshipKey(
        rel.parentEntityId,
        rel.childEntityId,
        rel.relationshipType,
      );
      desiredKeys.add(key);

      const existingRel = existingMap.get(key);

      if (!existingRel) {
        // CREATE: New relationship
        toCreate.push({
          dataSourceId,
          parentEntityId: rel.parentEntityId,
          childEntityId: rel.childEntityId,
          relationshipType: rel.relationshipType,
          metadata: rel.metadata || {},
          lastSeenAt: now,
          syncId,
          updatedAt: now,
        });
      } else {
        // UPDATE: Relationship exists, update metadata and lastSeenAt
        const metadataChanged =
          JSON.stringify(existingRel.metadata) !== JSON.stringify(rel.metadata);

        if (metadataChanged) {
          toUpdate.push({
            id: existingRel._id,
            updates: {
              metadata: rel.metadata,
              lastSeenAt: now,
              syncId,
              updatedAt: now,
            },
          });
        } else {
          // Just bump lastSeenAt
          toUpdate.push({
            id: existingRel._id,
            updates: {
              lastSeenAt: now,
              syncId,
              updatedAt: now,
            },
          });
        }
      }
    }

    // DELETE: Stale relationships not seen in this sync
    const toDelete: Id<"entity_relationships">[] = [];
    for (const rel of existing) {
      const key = this.getRelationshipKey(
        rel.parentEntityId,
        rel.childEntityId,
        rel.relationshipType,
      );
      if (!desiredKeys.has(key)) {
        toDelete.push(rel._id);
      }
    }

    Logger.log({
      module: "BaseLinker",
      context: "reconcileRelationships",
      message: `Categorized: ${toCreate.length} to create, ${toUpdate.length} to update, ${toDelete.length} to delete`,
      level: "trace",
    });

    // Execute batch operations (3 mutations max)
    if (toCreate.length > 0) {
      this.metrics.trackMutation();
      await this.convex.mutation(api.helpers.orm.insert_s, {
        tableName: "entity_relationships",
        tenantId,
        data: toCreate,
        secret: this.secret,
      });

      Logger.log({
        module: "BaseLinker",
        context: "reconcileRelationships",
        message: `Created ${toCreate.length} relationships`,
        level: "trace",
      });
    }

    if (toUpdate.length > 0) {
      this.metrics.trackMutation();
      await this.convex.mutation(api.helpers.orm.update_s, {
        tableName: "entity_relationships",
        data: toUpdate,
        secret: this.secret,
      });

      Logger.log({
        module: "BaseLinker",
        context: "reconcileRelationships",
        message: `Updated ${toUpdate.length} relationships`,
        level: "trace",
      });
    }

    if (toDelete.length > 0) {
      this.metrics.trackMutation();
      // Delete in chunks of 100 to avoid hitting limits
      const deleteChunks = this.chunkArray(toDelete, 100);
      for (const chunk of deleteChunks) {
        await this.convex.mutation(api.helpers.orm.remove_s, {
          tableName: "entity_relationships",
          tenantId,
          ids: chunk,
          secret: this.secret,
        });
      }

      Logger.log({
        module: "BaseLinker",
        context: "reconcileRelationships",
        message: `Deleted ${toDelete.length} stale relationships`,
        level: "trace",
      });
    }

    return {
      relationshipsCreated: toCreate.length,
      relationshipsUpdated: toUpdate.length,
      relationshipsDeleted: toDelete.length,
    };
  }

  /**
   * Generate unique key for relationship
   * Format: parentId:childId:type
   */
  private getRelationshipKey(
    parentId: Id<"entities">,
    childId: Id<"entities">,
    type: string,
  ): string {
    return `${parentId}:${childId}:${type}`;
  }

  /**
   * Split array into chunks
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Trigger analyze stage after linking
   */
  private async triggerAnalyze(
    tenantId: Id<"tenants">,
    integrationId: IntegrationId,
    dataSourceId: Id<"data_sources">,
    syncId: string,
    startedAt?: number,
    siteId?: Id<"sites">,
  ): Promise<void> {
    await queueManager.addJob(
      QueueNames.analyze,
      {
        tenantId,
        integrationId,
        dataSourceId,
        syncId,
        siteId,
        startedAt,
        metrics: this.metrics.toJSON(), // Pass accumulated metrics (adapter + processor + linker)
      },
      {
        priority: 5,
      },
    );

    Logger.log({
      module: "BaseLinker",
      context: "triggerAnalyze",
      message: `Triggered analyze job for datasource ${dataSourceId} with accumulated metrics`,
      level: "info",
    });
  }

  /**
   * Get current metrics
   */
  getMetrics(): any {
    return this.metrics.getMetrics();
  }

  /**
   * Stop the linker worker
   */
  async stop(): Promise<void> {
    await queueManager.closeAll();

    Logger.log({
      module: "BaseLinker",
      context: "stop",
      message: `${this.getLinkerName()} stopped`,
      level: "info",
    });
  }
}
