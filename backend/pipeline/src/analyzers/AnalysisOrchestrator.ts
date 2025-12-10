import { ConvexHttpClient } from "convex/browser";
import { api } from "@workspace/database/convex/_generated/api.js";
import { Job } from "bullmq";
import { AnalyzeJobData, QueueNames, queueManager } from "../lib/queue.js";
import { MetricsCollector } from "../lib/metrics.js";
import { Logger } from "../lib/logger.js";
import { JobHistoryManager } from "../lib/JobHistoryManager.js";
import type { Id } from "@workspace/database/convex/_generated/dataModel";
import type { IntegrationId } from "@workspace/shared/types/integrations";
import {
  AnalysisContext,
  Entity,
  Relationship,
  EntityState,
  Alert,
  AnalyzerResult,
} from "../types.js";
import { BaseAnalyzer } from "./BaseAnalyzer.js";
import { AlertManager } from "./AlertManager.js";

/**
 * AnalysisOrchestrator - Coordinates all analyzers with batched data loading
 *
 * Key responsibilities:
 * 1. Load data context ONCE (all entities + relationships for datasource)
 * 2. Pass context to all analyzers
 * 3. Run analyzers in parallel
 * 4. Merge results (alerts, tags, states)
 * 5. Batch apply changes (one mutation for tags/states)
 * 6. Send alerts to AlertManager
 *
 * Performance:
 * - Old: Each analyzer queries separately = N * 4 queries
 * - New: Load once, pass to all = 2 queries total
 */
export class AnalysisOrchestrator {
  private convex: ConvexHttpClient;
  private metrics: MetricsCollector;
  private secret: string;
  private analyzers: BaseAnalyzer[] = [];
  private alertManager: AlertManager;
  private jobHistoryManager: JobHistoryManager;

  constructor(convexUrl: string, analyzers: BaseAnalyzer[]) {
    this.convex = new ConvexHttpClient(convexUrl);
    this.metrics = new MetricsCollector();
    this.analyzers = analyzers;
    this.alertManager = new AlertManager(convexUrl);
    this.jobHistoryManager = new JobHistoryManager(convexUrl);

    // Validate CONVEX_API_KEY is set
    this.secret = process.env.CONVEX_API_KEY || "";
    if (!this.secret) {
      throw new Error(
        "CONVEX_API_KEY environment variable is required for AnalysisOrchestrator",
      );
    }
  }

  /**
   * Start the orchestrator worker
   */
  start(): void {
    queueManager.createWorker<AnalyzeJobData>(
      QueueNames.analyze,
      this.handleAnalyzeJob.bind(this),
      {
        concurrency: 10, // Multiple analyses in parallel
      },
    );

    Logger.log({
      module: "AnalysisOrchestrator",
      context: "start",
      message: `AnalysisOrchestrator started with ${this.analyzers.length} analyzers`,
      level: "info",
    });
  }

  /**
   * Handle analyze job from queue
   */
  private async handleAnalyzeJob(job: Job<AnalyzeJobData>): Promise<void> {
    const {
      tenantId,
      integrationId,
      dataSourceId,
      siteId,
      syncId,
      entityType,
      startedAt,
      metrics: previousMetrics,
    } = job.data;

    // Restore metrics from previous stages (adapter + processor + linker) if present
    if (previousMetrics) {
      const previous = MetricsCollector.fromJSON(previousMetrics);
      this.metrics = previous;
    } else {
      this.metrics.reset();
    }

    this.metrics.startStage("analyzer");

    const pipelineStartedAt = startedAt || Date.now();

    Logger.log({
      module: "AnalysisOrchestrator",
      context: "handleAnalyzeJob",
      message: `Starting analysis for datasource ${dataSourceId}`,
      level: "info",
    });

    try {
      // STEP 1: Load data context ONCE
      const context = await this.loadContext(
        tenantId,
        integrationId,
        dataSourceId,
        syncId,
      );

      Logger.log({
        module: "AnalysisOrchestrator",
        context: "handleAnalyzeJob",
        message: `Loaded context: ${Object.values(context.entities).flat().length} entities, ${context.relationships.length} relationships`,
        level: "trace",
      });

      // STEP 2: Run all analyzers in parallel
      const results = await Promise.all(
        this.analyzers.map(async (analyzer) => {
          try {
            const result = await analyzer.analyze(context);
            Logger.log({
              module: "AnalysisOrchestrator",
              context: "handleAnalyzeJob",
              message: `${analyzer.getName()}: ${result.alerts.length} alerts, ${result.entityTags.size} tagged, ${result.entityStates.size} state changes`,
              level: "trace",
            });
            return result;
          } catch (error) {
            Logger.log({
              module: "AnalysisOrchestrator",
              context: "handleAnalyzeJob",
              message: `${analyzer.getName()} failed: ${error}`,
              level: "error",
            });
            throw error;
          }
        }),
      );

      // STEP 3: Merge results
      const mergedTags = this.mergeTags(results);
      const mergedStates = this.mergeStates(results);
      const allAlerts = results.flatMap((r) => r.alerts);

      Logger.log({
        module: "AnalysisOrchestrator",
        context: "handleAnalyzeJob",
        message: `Merged: ${allAlerts.length} total alerts, ${mergedTags.size} entities with tags, ${mergedStates.size} entities with state changes`,
        level: "trace",
      });

      // STEP 4: Batch apply tags & states
      if (mergedTags.size > 0 || mergedStates.size > 0) {
        await this.batchApplyChanges(mergedTags, mergedStates);
      }

      // STEP 5: Process alerts (deduplication happens in AlertManager)
      await this.processAlerts(
        allAlerts,
        tenantId,
        integrationId,
        dataSourceId,
        syncId,
        siteId
      );

      this.metrics.endStage("analyzer");

      // STEP 6: Create job_history record with complete pipeline metrics
      const completedAt = Date.now();
      const action = entityType
        ? `sync.${entityType}`
        : `sync.${integrationId}`;

      await this.jobHistoryManager.createJobHistory({
        tenantId,
        integrationId,
        dataSourceId,
        action,
        status: "completed",
        startedAt: pipelineStartedAt,
        completedAt,
        metrics: this.metrics.toJSON(),
      });

      Logger.log({
        module: "AnalysisOrchestrator",
        context: "handleAnalyzeJob",
        message: `Analysis complete for datasource ${dataSourceId}, job_history recorded`,
        level: "info",
      });
    } catch (error) {
      this.metrics.trackError(error as Error, job.attemptsMade);
      this.metrics.endStage("analyzer");

      // Create failed job_history record
      const completedAt = Date.now();
      const action = entityType
        ? `sync.${entityType}`
        : `sync.${integrationId}`;

      try {
        await this.jobHistoryManager.createJobHistory({
          tenantId,
          integrationId,
          dataSourceId,
          action,
          status: "failed",
          startedAt: pipelineStartedAt,
          completedAt,
          metrics: this.metrics.toJSON(),
        });
      } catch (historyError) {
        Logger.log({
          module: "AnalysisOrchestrator",
          context: "handleAnalyzeJob",
          message: `Failed to create job_history record: ${historyError}`,
          level: "error",
        });
      }

      Logger.log({
        module: "AnalysisOrchestrator",
        context: "handleAnalyzeJob",
        message: `Analysis failed: ${error}`,
        level: "error",
      });

      throw error; // Re-throw to trigger BullMQ retry
    }
  }

  /**
   * Load analysis context (entities + relationships) in one batch
   */
  private async loadContext(
    tenantId: Id<"tenants">,
    integrationId: IntegrationId,
    dataSourceId: Id<"data_sources">,
    syncId: string,
  ): Promise<AnalysisContext> {
    // Fetch all entities for this datasource
    this.metrics.trackQuery();
    const allEntities = (await this.convex.query(api.helpers.orm.list_s, {
      tableName: "entities",
      tenantId,
      secret: this.secret,
      filters: {
        dataSourceId,
      },
    })) as Entity[];

    // Group entities by type
    const entities = {
      identities: allEntities.filter((e) => e.entityType === "identities"),
      policies: allEntities.filter((e) => e.entityType === "policies"),
      licenses: allEntities.filter((e) => e.entityType === "licenses"),
      groups: allEntities.filter((e) => e.entityType === "groups"),
      roles: allEntities.filter((e) => e.entityType === "roles"),
      companies: allEntities.filter((e) => e.entityType === "companies"),
      endpoints: allEntities.filter((e) => e.entityType === "endpoints"),
      firewalls: allEntities.filter((e) => e.entityType === "firewalls"),
    };

    // Fetch all relationships for this datasource
    this.metrics.trackQuery();
    const relationships = (await this.convex.query(api.helpers.orm.list_s, {
      tableName: "entity_relationships",
      tenantId,
      secret: this.secret,
      filters: {
        dataSourceId,
      },
    })) as Relationship[];

    // Create entity lookup map
    const entityMap = new Map(allEntities.map((e) => [e._id, e]));

    // Helper methods for analyzers
    const context: AnalysisContext = {
      tenantId,
      integrationId,
      dataSourceId,
      syncId,
      entities,
      relationships,

      getEntity(id: Id<"entities">): Entity | undefined {
        return entityMap.get(id);
      },

      getRelationships(
        entityId: Id<"entities">,
        type?: string,
      ): Relationship[] {
        return relationships.filter(
          (r) =>
            (r.parentEntityId === entityId || r.childEntityId === entityId) &&
            (!type || r.relationshipType === type),
        );
      },

      getChildEntities(parentId: Id<"entities">): Entity[] {
        const childIds = relationships
          .filter((r) => r.parentEntityId === parentId)
          .map((r) => r.childEntityId);
        return childIds
          .map((id) => entityMap.get(id))
          .filter((e) => e !== undefined) as Entity[];
      },

      getParentEntity(childId: Id<"entities">): Entity | undefined {
        const parentRel = relationships.find(
          (r) => r.childEntityId === childId,
        );
        return parentRel ? entityMap.get(parentRel.parentEntityId) : undefined;
      },
    };

    return context;
  }

  /**
   * Merge tags from all analyzer results
   * Combines all tags for each entity
   */
  private mergeTags(results: AnalyzerResult[]): Map<Id<"entities">, string[]> {
    const merged = new Map<Id<"entities">, Set<string>>();

    for (const result of results) {
      for (const [entityId, tags] of result.entityTags) {
        if (!merged.has(entityId)) {
          merged.set(entityId, new Set());
        }
        tags.forEach((tag) => merged.get(entityId)!.add(tag));
      }
    }

    // Convert Set back to array
    return new Map(
      Array.from(merged.entries()).map(([id, tagSet]) => [
        id,
        Array.from(tagSet),
      ]),
    );
  }

  /**
   * Merge states from all analyzer results
   * Keeps highest severity state for each entity
   */
  private mergeStates(
    results: AnalyzerResult[],
  ): Map<Id<"entities">, EntityState> {
    const merged = new Map<Id<"entities">, EntityState>();
    const statePriority: Record<EntityState, number> = {
      normal: 0,
      low: 1,
      warn: 2,
      high: 3,
      critical: 4,
    };

    for (const result of results) {
      for (const [entityId, state] of result.entityStates) {
        const existing = merged.get(entityId) || "normal";
        // Keep highest severity state
        if (statePriority[state] >= statePriority[existing]) {
          merged.set(entityId, state);
        }
      }
    }

    return merged;
  }

  /**
   * Batch apply tags and states to entities
   * ONE mutation for all changes
   */
  private async batchApplyChanges(
    tags: Map<Id<"entities">, string[]>,
    states: Map<Id<"entities">, EntityState>,
  ): Promise<void> {
    // Collect all entity IDs that need updates
    const entityIds = new Set([...tags.keys(), ...states.keys()]);

    const updates = Array.from(entityIds).map((id) => ({
      id,
      updates: {
        tags: tags.get(id),
        state: states.get(id),
        updatedAt: Date.now(),
      },
    }));

    // Apply all changes in one mutation
    this.metrics.trackMutation();
    await this.convex.mutation(api.helpers.orm.update_s, {
      tableName: "entities",
      data: updates,
      secret: this.secret,
    });

    Logger.log({
      module: "AnalysisOrchestrator",
      context: "batchApplyChanges",
      message: `Applied changes to ${updates.length} entities`,
      level: "trace",
    });
  }

  /**
   * Process alerts using AlertManager for deduplication
   */
  private async processAlerts(
    alerts: Alert[],
    tenantId: Id<"tenants">,
    integrationId: IntegrationId,
    dataSourceId: Id<"data_sources">,
    syncId: string,
    siteId?: Id<"sites">
  ): Promise<void> {
    const result = await this.alertManager.processAlerts(
      alerts,
      tenantId,
      integrationId,
      dataSourceId,
      syncId,
      siteId
    );

    Logger.log({
      module: "AnalysisOrchestrator",
      context: "processAlerts",
      message: `Alert processing: ${result.created} created, ${result.updated} updated, ${result.resolved} resolved`,
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
   * Stop the orchestrator worker
   */
  async stop(): Promise<void> {
    await queueManager.closeAll();

    Logger.log({
      module: "AnalysisOrchestrator",
      context: "stop",
      message: "AnalysisOrchestrator stopped",
      level: "info",
    });
  }
}
