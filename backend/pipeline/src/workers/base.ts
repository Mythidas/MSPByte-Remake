import Debug from "@workspace/shared/lib/Debug.js";
import { natsClient } from "@workspace/pipeline/helpers/nats.js";
import {
    LinkedEventPayload,
    buildEventName,
    EntityType,
} from "@workspace/shared/types/pipeline/index.js";

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
    private debounceTimer: NodeJS.Timeout | null = null;
    private aggregatedEvents: LinkedEventPayload[] = [];

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
     */
    private async handleLinkedEvent(event: LinkedEventPayload): Promise<void> {
        Debug.log({
            module: "BaseWorker",
            context: this.constructor.name,
            message: `Received ${event.stage}.${event.entityType} event (ID: ${event.eventID})`,
        });

        // Add event to aggregation buffer
        this.aggregatedEvents.push(event);

        // Clear existing timer if present
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }

        // Set new debounce timer
        this.debounceTimer = setTimeout(async () => {
            await this.executeWithAggregation();
        }, this.debounceMs);

        Debug.log({
            module: "BaseWorker",
            context: this.constructor.name,
            message: `Event aggregated (${this.aggregatedEvents.length} total). Execution scheduled in ${this.debounceMs}ms`,
        });
    }

    /**
     * Executes the worker with aggregated events
     * Combines changedEntityIds from all events and calls execute()
     */
    private async executeWithAggregation(): Promise<void> {
        const eventsToProcess = [...this.aggregatedEvents];
        this.aggregatedEvents = []; // Clear buffer
        this.debounceTimer = null;

        if (eventsToProcess.length === 0) {
            return;
        }

        Debug.log({
            module: "BaseWorker",
            context: this.constructor.name,
            message: `Executing with ${eventsToProcess.length} aggregated events`,
        });

        try {
            // Use the most recent event as the base
            const latestEvent = eventsToProcess[eventsToProcess.length - 1];

            // Aggregate all changed entity IDs from all events
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
}
