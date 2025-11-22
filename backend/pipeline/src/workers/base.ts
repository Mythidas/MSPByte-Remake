import Debug from "@workspace/shared/lib/Debug.js";
import { natsClient } from "@workspace/pipeline/helpers/nats.js";
import {
    LinkedEventPayload,
    buildEventName,
    EntityType,
} from "@workspace/shared/types/pipeline/index.js";
import { api } from "@workspace/database/convex/_generated/api.js";
import type { Doc, Id } from "@workspace/database/convex/_generated/dataModel.js";
import { client } from "@workspace/shared/lib/convex.js";
import type { AnalysisEvent, EntityFinding } from "@workspace/shared/types/events/analysis.js";
import { randomUUID } from "crypto";

/**
 * BaseWorker - Abstract base class for all pipeline workers
 *
 * Follows the BaseAdapter pattern:
 * - BaseWorker controls: event subscription, debouncing, flow orchestration
 * - Child workers provide: entity dependencies and execute() implementation
 *
 * Features:
 * - Auto-subscribes to linked.{entityType} events for declared dependencies
 * - Implements 5-minute debouncing to batch rapid events
 * - Aggregates events during debounce window
 * - Provides changedEntityIds for incremental analysis
 */
export abstract class BaseWorker {
    protected entityTypes: EntityType[];
    protected debounceMs: number;
    protected requiresFullContext: boolean = false; // Default: can work with partial data
    private debounceTimersBySyncId = new Map<string, NodeJS.Timeout>();
    private aggregatedEventsBySyncId = new Map<string, LinkedEventPayload[]>();

    constructor(
        entityTypes: EntityType[],
        debounceMs: number = 300000 // 5 minutes default
    ) {
        this.entityTypes = entityTypes;
        this.debounceMs = debounceMs;
    }

    /**
     * Starts the worker by subscribing to all dependency events
     */
    async start(): Promise<void> {
        Debug.log({
            module: "BaseWorker",
            context: this.constructor.name,
            message: `Starting worker with dependencies: ${this.entityTypes.join(", ")}`,
        });

        // Subscribe to linked.{entityType} for each dependency
        for (const entityType of this.entityTypes) {
            const eventName = buildEventName("linked", entityType);

            await natsClient.subscribe(
                eventName,
                this.handleLinkedEvent.bind(this)
            );

            Debug.log({
                module: "BaseWorker",
                context: this.constructor.name,
                message: `Subscribed to ${eventName}`,
            });
        }

        Debug.log({
            module: "BaseWorker",
            context: this.constructor.name,
            message: `Worker started successfully (debounce: ${this.debounceMs}ms)`,
        });
    }

    /**
     * Handles incoming linked events with debouncing
     * Aggregates events during the debounce window
     *
     * Pagination support: Workers with requiresFullContext=true will buffer
     * all batches and only execute when the final batch is received (isFinalBatch=true)
     */
    private async handleLinkedEvent(event: LinkedEventPayload): Promise<void> {
        const isFinalBatch = event.syncMetadata?.isFinalBatch ?? true; // Default true for non-paginated syncs
        const syncId = event.syncMetadata?.syncId || 'default';
        const batchNumber = event.syncMetadata?.batchNumber;

        Debug.log({
            module: "BaseWorker",
            context: this.constructor.name,
            message: `Received ${event.stage}.${event.entityType} event (ID: ${event.eventID}, syncId: ${syncId}, batch: ${batchNumber || 'N/A'}, final: ${isFinalBatch})`,
        });

        // ALWAYS add event to aggregation buffer (even non-final batches)
        if (!this.aggregatedEventsBySyncId.has(syncId)) {
            this.aggregatedEventsBySyncId.set(syncId, []);
        }
        this.aggregatedEventsBySyncId.get(syncId)!.push(event);

        const bufferSize = this.aggregatedEventsBySyncId.get(syncId)!.length;

        Debug.log({
            module: "BaseWorker",
            context: this.constructor.name,
            message: `Event buffered for syncId ${syncId} (${bufferSize} events buffered, batch ${batchNumber || 'N/A'}, final: ${isFinalBatch})`,
        });

        // If worker requires full context, only execute on final batch
        if (this.requiresFullContext && !isFinalBatch) {
            Debug.log({
                module: "BaseWorker",
                context: this.constructor.name,
                message: `Waiting for final batch - worker requires full context (syncId: ${syncId}, ${bufferSize} batches buffered)`,
            });
            return; // Exit here, AFTER adding to buffer
        }

        // Clear existing timer for this syncId if present
        if (this.debounceTimersBySyncId.has(syncId)) {
            clearTimeout(this.debounceTimersBySyncId.get(syncId)!);
        }

        // Set new debounce timer for this syncId
        const timer = setTimeout(async () => {
            await this.executeWithAggregation(syncId);
        }, this.debounceMs);

        this.debounceTimersBySyncId.set(syncId, timer);

        Debug.log({
            module: "BaseWorker",
            context: this.constructor.name,
            message: `Execution scheduled for syncId ${syncId} in ${this.debounceMs}ms (${bufferSize} events will be processed)`,
        });
    }

    /**
     * Executes the worker with aggregated events for a specific syncId
     * Combines changedEntityIds from all events in that sync and calls execute()
     */
    private async executeWithAggregation(syncId: string): Promise<void> {
        const eventsToProcess = this.aggregatedEventsBySyncId.get(syncId) || [];

        // Clear buffer and timer for this syncId only
        this.aggregatedEventsBySyncId.delete(syncId);
        this.debounceTimersBySyncId.delete(syncId);

        if (eventsToProcess.length === 0) {
            return;
        }

        Debug.log({
            module: "BaseWorker",
            context: this.constructor.name,
            message: `Executing with ${eventsToProcess.length} aggregated events (syncId: ${syncId})`,
        });

        try {
            // Use the most recent event as the base
            const latestEvent = eventsToProcess[eventsToProcess.length - 1];

            // Aggregate all changed entity IDs from all events in this sync
            const allChangedIds = new Set<string>();
            for (const event of eventsToProcess) {
                if (event.changedEntityIds) {
                    event.changedEntityIds.forEach(id => allChangedIds.add(id));
                }
            }

            // Create aggregated event with combined changedEntityIds
            const aggregatedEvent: LinkedEventPayload = {
                ...latestEvent,
                changedEntityIds: allChangedIds.size > 0
                    ? Array.from(allChangedIds) as any[]
                    : undefined,
            };

            // Call the abstract execute method implemented by child workers
            await this.execute(aggregatedEvent);

            Debug.log({
                module: "BaseWorker",
                context: this.constructor.name,
                message: `Execution completed successfully. Processed ${allChangedIds.size} changed entities.`,
            });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            Debug.error({
                module: "BaseWorker",
                context: this.constructor.name,
                message: `Error during worker execution: ${errorMessage}`,
            });

            // Don't throw - workers should be resilient
            // Future: Could implement retry logic or dead letter queue here
        }
    }

    /**
     * Abstract method that child workers must implement
     * Called after debounce period with aggregated events
     *
     * @param event - Aggregated event containing combined changedEntityIds
     */
    protected abstract execute(event: LinkedEventPayload): Promise<void>;

    /**
     * Calculate identity state based on active alerts
     *
     * @param entityId - ID of the identity entity
     * @param tenantID - Tenant ID for filtering
     * @returns "critical" | "warn" | "normal"
     */
    protected async calculateIdentityState(
        entityId: Id<"entities">,
        tenantID: Id<"tenants">
    ): Promise<"normal" | "low" | "warn" | "critical"> {
        try {
            // Query all active alerts for this entity
            const alerts = await client.query(api.helpers.orm.list_s, {
                tableName: "entity_alerts",
                secret: process.env.CONVEX_API_KEY!,
                index: {
                    name: "by_entity_status",
                    params: {
                        entityId,
                        status: "active",
                    },
                },
                tenantId: tenantID,
            }) as Doc<"entity_alerts">[];

            // Check for critical or high severity alerts
            const hasCriticalOrHigh = alerts.some(
                alert => alert.severity === "critical" || alert.severity === "high"
            );
            if (hasCriticalOrHigh) {
                return "critical";
            }

            // Check for medium severity alerts
            const hasMedium = alerts.some(alert => alert.severity === "medium");
            if (hasMedium) {
                return "warn";
            }

            // Check for low severity alerts
            const hasLow = alerts.some(alert => alert.severity === "low");
            if (hasLow) {
                return "low";
            }

            // No alerts = normal state
            return "normal";
        } catch (error) {
            Debug.error({
                module: "BaseWorker",
                context: "calculateIdentityState",
                message: `Failed to calculate state: ${error}`,
            });
            // Default to normal on error to avoid blocking
            return "normal";
        }
    }

    /**
     * Update identity state if it has changed
     *
     * @param identity - The identity entity to update
     * @param newState - The new state to set
     */
    protected async updateIdentityState(
        identity: Doc<"entities">,
        newState: "normal" | "low" | "warn" | "critical"
    ): Promise<void> {
        const currentState = identity.state;

        // Only update if state has changed
        if (currentState === newState) {
            return;
        }

        try {
            await client.mutation(api.helpers.orm.update_s, {
                tableName: "entities",
                secret: process.env.CONVEX_API_KEY!,
                data: [{
                    id: identity._id,
                    updates: {
                        state: newState,
                        updatedAt: Date.now(),
                    },
                }],
            });

            Debug.log({
                module: "BaseWorker",
                context: "updateIdentityState",
                message: `Updated identity ${identity._id} state: ${currentState || 'undefined'} → ${newState}`,
            });
        } catch (error) {
            Debug.error({
                module: "BaseWorker",
                context: "updateIdentityState",
                message: `Failed to update state: ${error}`,
            });
        }
    }

    /**
     * Emit analysis event for AlertManager to process
     *
     * Workers should use this to report their findings instead of creating alerts directly.
     * AlertManager will aggregate findings from all workers and create composite alerts.
     *
     * @param event - The original linked event
     * @param analysisType - Type of analysis (e.g., "mfa", "stale", "license", "policy")
     * @param findings - Array of entity findings with severity and domain-specific data
     */
    protected async emitAnalysis(
        event: LinkedEventPayload,
        analysisType: string,
        findings: EntityFinding[]
    ): Promise<void> {
        const analysisEvent: AnalysisEvent = {
            analysisId: randomUUID(),
            tenantID: event.tenantID,
            dataSourceID: event.dataSourceID,
            integrationID: event.integrationID,
            integrationType: event.integrationType,
            analysisType,
            entityType: event.entityType,
            findings,
            createdAt: Date.now(),
        };

        const topic = `analysis.${analysisType}.${event.entityType}`;

        await natsClient.publish(topic, analysisEvent);

        Debug.log({
            module: "BaseWorker",
            context: this.constructor.name,
            message: `Emitted ${analysisType} analysis for ${findings.length} entities to ${topic}`,
        });
    }

    /**
     * Emit tag analysis to TagManager
     */
    protected async emitTagAnalysis(
        event: LinkedEventPayload,
        analysisType: string,
        tagFindings: Array<{ entityId: Id<"entities">, tagsToAdd: string[], tagsToRemove: string[] }>
    ): Promise<void> {
        const tagAnalysisEvent = {
            analysisType,
            entityType: event.entityType,
            tenantID: event.tenantID,
            dataSourceID: event.dataSourceID,
            integrationID: event.integrationID,
            findings: tagFindings,
        };

        const topic = `tag.${analysisType}.${event.entityType}`;

        await natsClient.publish(topic, tagAnalysisEvent);

        Debug.log({
            module: "BaseWorker",
            context: this.constructor.name,
            message: `Emitted ${analysisType} tag analysis for ${tagFindings.length} entities to ${topic}`,
        });
    }
}
