import { natsClient } from "@workspace/pipeline/helpers/nats.js";
import { client } from "@workspace/shared/lib/convex.js";
import { api } from "@workspace/database/convex/_generated/api.js";
import type { Doc, Id } from "@workspace/database/convex/_generated/dataModel.js";
import Debug from "@workspace/shared/lib/Debug.js";

/**
 * Tag finding emitted by analyzers
 */
export interface TagFinding {
    entityId: Id<"entities">;
    tagsToAdd: string[];
    tagsToRemove: string[];
}

/**
 * Tag analysis event from analyzers
 */
export interface TagAnalysisEvent {
    analysisType: string; // "mfa", "stale", etc.
    entityType: string; // "identities", etc.
    tenantID: Id<"tenants">;
    dataSourceID: Id<"data_sources">;
    integrationID: Id<"integrations">;
    findings: TagFinding[];
}

/**
 * TagManager - Aggregates tag findings from multiple analyzers and manages entity tags
 *
 * Architecture:
 * 1. Analyzers emit tag.{type}.{entityType} events with tag findings
 * 2. TagManager subscribes to tag.* and aggregates by entity
 * 3. After aggregation window (30s), determines final tag state for each entity
 * 4. Batch updates entity tags, auto-removing tags when findings disappear
 * 5. Eliminates race conditions by being single source of truth for analyzer-based tags
 *
 * Note: This handles only analyzer-based tags (MFA, Stale, etc.)
 *       Relationship-based tags (Admin) are still managed by Linker
 */
export class TagManager {
    private tagCache = new Map<string, Map<string, TagAnalysisEvent>>();
    private aggregationTimers = new Map<string, NodeJS.Timeout>();
    private aggregationWindow = 30000; // 30 seconds to wait for all analyzers

    async start(): Promise<void> {
        Debug.log({
            module: "TagManager",
            context: "start",
            message: "Starting TagManager...",
        });

        await natsClient.subscribe("tag.>", this.handleTagAnalysis.bind(this));

        Debug.log({
            module: "TagManager",
            context: "start",
            message: "TagManager started, subscribed to tag.> events",
        });
    }

    /**
     * Handle incoming tag analysis event from an analyzer
     */
    private async handleTagAnalysis(event: TagAnalysisEvent): Promise<void> {
        const cacheKey = `${event.tenantID}-${event.dataSourceID}`;

        Debug.log({
            module: "TagManager",
            context: "handleTagAnalysis",
            message: `Received ${event.analysisType} tag analysis for ${event.findings.length} entities`,
        });

        // Initialize cache for this tenant+dataSource if needed
        if (!this.tagCache.has(cacheKey)) {
            this.tagCache.set(cacheKey, new Map());
        }

        const cache = this.tagCache.get(cacheKey)!;
        cache.set(event.analysisType, event);

        // Clear existing aggregation timer
        if (this.aggregationTimers.has(cacheKey)) {
            clearTimeout(this.aggregationTimers.get(cacheKey)!);
        }

        // Set new aggregation timer
        const timer = setTimeout(async () => {
            await this.processAggregatedTags(cacheKey);
        }, this.aggregationWindow);

        this.aggregationTimers.set(cacheKey, timer);

        Debug.log({
            module: "TagManager",
            context: "handleTagAnalysis",
            message: `Cached ${event.analysisType} tag analysis. Total cached: ${cache.size}. Aggregation scheduled in ${this.aggregationWindow}ms`,
        });
    }

    /**
     * Process aggregated tag findings after all analyzers have reported
     */
    private async processAggregatedTags(cacheKey: string): Promise<void> {
        const cache = this.tagCache.get(cacheKey);
        if (!cache || cache.size === 0) {
            return;
        }

        const analyses = Array.from(cache.values());
        const firstAnalysis = analyses[0];

        Debug.log({
            module: "TagManager",
            context: "processAggregatedTags",
            message: `Aggregated findings for ${cache.size} tag analysis types`,
        });

        try {
            // Group tag findings by entity
            const entityTagMap = new Map<Id<"entities">, TagFinding[]>();

            for (const analysis of analyses) {
                for (const finding of analysis.findings) {
                    if (!entityTagMap.has(finding.entityId)) {
                        entityTagMap.set(finding.entityId, []);
                    }
                    entityTagMap.get(finding.entityId)!.push(finding);
                }
            }

            Debug.log({
                module: "TagManager",
                context: "processAggregatedTags",
                message: `Processing tag updates for ${entityTagMap.size} entities`,
            });


            const updates: { id: Id<'entities'>, updates: Partial<Doc<'entities'>> }[] = [];
            // Process each entity's tags
            for (const [entityId, findings] of entityTagMap) {
                const update = await this.processEntityTags(
                    entityId,
                    findings,
                    firstAnalysis.tenantID
                );
                if (update) {
                    updates.push({ id: entityId, updates: update });
                }
            }

            if (updates.length > 0) {
                await client.mutation(api.helpers.orm.update_s, {
                    tableName: 'entities',
                    secret: process.env.CONVEX_API_KEY!,
                    data: updates
                });
            }

            // Clear cache for this tenant+dataSource
            this.tagCache.delete(cacheKey);
            this.aggregationTimers.delete(cacheKey);

            Debug.log({
                module: "TagManager",
                context: "processAggregatedTags",
                message: `Tag processing complete for ${entityTagMap.size} entities`,
            });
        } catch (error) {
            Debug.error({
                module: "TagManager",
                context: "processAggregatedTags",
                message: `Failed to process aggregated tags: ${error}`,
            });
        }
    }

    /**
     * Process tag updates for a single entity
     */
    private async processEntityTags(
        entityId: Id<"entities">,
        findings: TagFinding[],
        tenantID: Id<"tenants">
    ): Promise<Partial<Doc<'entities'>> | undefined> {
        try {
            // Get current entity to read existing tags
            const entity = await client.query(api.helpers.orm.get_s, {
                tableName: "entities",
                secret: process.env.CONVEX_API_KEY!,
                id: entityId,
                tenantId: tenantID,
            }) as Doc<"entities"> | null;

            if (!entity) {
                Debug.log({
                    module: "TagManager",
                    context: "processEntityTags",
                    message: `Entity ${entityId} not found, skipping`,
                });
                return undefined;
            }

            // Get current tags from normalizedData
            const currentTags = new Set<string>(entity.normalizedData?.tags || []);

            // Collect all tags to add and remove from all findings
            const allTagsToAdd = new Set<string>();
            const allTagsToRemove = new Set<string>();

            for (const finding of findings) {
                finding.tagsToAdd.forEach(tag => allTagsToAdd.add(tag));
                finding.tagsToRemove.forEach(tag => allTagsToRemove.add(tag));
            }

            // Apply tag changes
            let tagsChanged = false;

            // Remove tags
            for (const tag of allTagsToRemove) {
                if (currentTags.has(tag)) {
                    currentTags.delete(tag);
                    tagsChanged = true;
                }
            }

            // Add tags
            for (const tag of allTagsToAdd) {
                if (!currentTags.has(tag)) {
                    currentTags.add(tag);
                    tagsChanged = true;
                }
            }

            // Update entity if tags changed
            if (tagsChanged) {
                return { normalizedData: { ...entity.normalizedData, tags: Array.from(currentTags) } };
            }
        } catch (error) {
            Debug.error({
                module: "TagManager",
                context: "processEntityTags",
                message: `Failed to process tags for entity ${entityId}: ${error}`,
            });
        }
    }
}
