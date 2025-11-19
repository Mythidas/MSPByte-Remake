import { BaseWorker } from "@workspace/pipeline/workers/base.js";
import { api } from "@workspace/database/convex/_generated/api.js";
import type { Doc, Id } from "@workspace/database/convex/_generated/dataModel.js";
import { client } from "@workspace/shared/lib/convex.js";
import Debug from "@workspace/shared/lib/Debug.js";
import { LinkedEventPayload } from "@workspace/shared/types/pipeline/index.js";
import type { StaleUserFinding } from "@workspace/shared/types/events/analysis.js";

const STALE_THRESHOLD_DAYS = 90;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export class Microsoft365StaleUserAnalyzer extends BaseWorker {
    constructor() {
        // Declare dependencies: only identities
        super(["identities"]);

        // Can work with partial data: Identities can be analyzed incrementally per batch
        this.requiresFullContext = false;
    }

    protected async execute(event: LinkedEventPayload): Promise<void> {
        const { tenantID, integrationID, integrationType, dataSourceID, changedEntityIds } = event;

        if (integrationType !== "microsoft-365") return;

        Debug.log({
            module: "Microsoft365StaleUserAnalyzer",
            context: "execute",
            message: `Analyzing stale users for tenant ${tenantID}`,
        });

        try {
            // Determine which identities to analyze
            let identitiesToAnalyze: Doc<"entities">[];

            if (!changedEntityIds || changedEntityIds.length === 0) {
                // Get all identity entities for this data source
                identitiesToAnalyze = await client.query(api.helpers.orm.list_s, {
                    tableName: "entities",
                    secret: process.env.CONVEX_API_KEY!,
                    index: {
                        name: "by_data_source",
                        params: {
                            dataSourceId: dataSourceID as Id<"data_sources">,
                        },
                    },
                    filters: {
                        entityType: "identities"
                    },
                    tenantId: tenantID as Id<"tenants">,
                }) as Doc<"entities">[];
            } else {
                // Hybrid incremental: Analyze changed identities + potentially stale users
                const staleThresholdDate = new Date(Date.now() - STALE_THRESHOLD_DAYS * MS_PER_DAY).toISOString();

                // Get potentially stale enabled users (includes users with 1970 dates who never logged in)
                const potentiallyStaleUsers = await client.query(api.helpers.orm.list_s, {
                    tableName: "entities",
                    secret: process.env.CONVEX_API_KEY!,
                    index: {
                        name: "by_data_source_type",
                        params: {
                            dataSourceId: dataSourceID as Id<"data_sources">,
                            entityType: "identities",
                        },
                    },
                    filters: {
                        "normalizedData.enabled": true,
                        "normalizedData.last_login_at": { lt: staleThresholdDate }
                    } as any, // Type assertion needed for nested field paths
                    tenantId: tenantID as Id<"tenants">,
                }) as Doc<"entities">[];

                // Fetch changed identities
                const changedIdentities: Doc<"entities">[] = [];
                for (const entityId of changedEntityIds) {
                    const identity = await client.query(api.helpers.orm.get_s, {
                        tableName: "entities",
                        id: entityId as Id<"entities">,
                        secret: process.env.CONVEX_API_KEY!,
                    }) as Doc<"entities"> | null;

                    if (identity && identity.entityType === "identities") {
                        changedIdentities.push(identity);
                    }
                }

                // Deduplicate: combine changed + stale users without duplicates
                const processedIds = new Set<string>();
                identitiesToAnalyze = [];

                // Add changed identities first
                for (const identity of changedIdentities) {
                    processedIds.add(identity._id);
                    identitiesToAnalyze.push(identity);
                }

                // Add potentially stale users that weren't already changed
                for (const identity of potentiallyStaleUsers) {
                    if (!processedIds.has(identity._id)) {
                        processedIds.add(identity._id);
                        identitiesToAnalyze.push(identity);
                    }
                }
            }

            Debug.log({
                module: "Microsoft365StaleUserAnalyzer",
                context: "execute",
                message: `Analyzing ${identitiesToAnalyze.length} identities (incremental: ${!!changedEntityIds})`,
            });

            const now = Date.now();
            const tagUpdates: Array<{ id: Id<"entities">, normalizedData: any }> = [];
            const findings: StaleUserFinding[] = [];
            let staleTagsAdded = 0;
            let staleTagsRemoved = 0;

            for (const identity of identitiesToAnalyze) {
                const lastLoginStr = identity.normalizedData.last_login_at;
                const lastLoginDate = new Date(lastLoginStr).getTime();
                const daysSinceLogin = (now - lastLoginDate) / MS_PER_DAY;

                const isStale = daysSinceLogin >= STALE_THRESHOLD_DAYS;
                const identityTags = [...(identity.normalizedData.tags || [])];
                const enabled = identity.normalizedData.enabled;
                const hasLicenses = identity.normalizedData.licenses?.length > 0;
                const isAdmin = identityTags.includes("Admin");

                // ==== TAG MANAGEMENT ====
                let tagsChanged = false;

                // Update Stale tag
                if (isStale && !identityTags.includes("Stale")) {
                    identityTags.push("Stale");
                    tagsChanged = true;
                    staleTagsAdded++;
                } else if (!isStale && identityTags.includes("Stale")) {
                    const index = identityTags.indexOf("Stale");
                    identityTags.splice(index, 1);
                    tagsChanged = true;
                    staleTagsRemoved++;
                }

                if (tagsChanged) {
                    tagUpdates.push({
                        id: identity._id,
                        normalizedData: {
                            ...identity.normalizedData,
                            tags: identityTags,
                        }
                    });
                }

                // ==== FINDINGS COLLECTION ====
                // Only create findings for stale enabled users
                if (isStale && enabled) {
                    let severity: "low" | "medium" | "high" = "medium";
                    if (isAdmin) {
                        severity = "high";
                    } else if (!hasLicenses) {
                        severity = "low";
                    }

                    findings.push({
                        entityId: identity._id,
                        severity,
                        findings: {
                            isStale: true,
                            daysSinceLogin: Math.floor(daysSinceLogin),
                            hasLicenses,
                            isEnabled: enabled,
                        }
                    });
                }
                // Note: If !isStale || !enabled, no finding is created
                // This signals to AlertManager that any existing alerts should be resolved
            }

            Debug.log({
                module: "Microsoft365StaleUserAnalyzer",
                context: "execute",
                message: `Tag changes: Stale +${staleTagsAdded}/-${staleTagsRemoved}`,
            });

            // Batch update tags
            if (tagUpdates.length > 0) {
                try {
                    await client.mutation(api.helpers.orm.update_s, {
                        tableName: "entities",
                        secret: process.env.CONVEX_API_KEY!,
                        data: tagUpdates.map(update => ({
                            id: update.id,
                            updates: {
                                normalizedData: update.normalizedData,
                                updatedAt: Date.now(),
                            },
                        })),
                    });

                    Debug.log({
                        module: "Microsoft365StaleUserAnalyzer",
                        context: "execute",
                        message: `Successfully updated tags for ${tagUpdates.length} identities`,
                    });
                } catch (error) {
                    Debug.error({
                        module: "Microsoft365StaleUserAnalyzer",
                        context: "execute",
                        message: `Failed to update tags: ${error}`,
                    });
                    // Don't throw - continue with analysis emission
                }
            }

            // Emit analysis findings
            Debug.log({
                module: "Microsoft365StaleUserAnalyzer",
                context: "execute",
                message: `Emitting stale user analysis: ${findings.length} findings for stale enabled users`,
            });

            await this.emitAnalysis(event, "stale", findings);

            Debug.log({
                module: "Microsoft365StaleUserAnalyzer",
                context: "execute",
                message: `Completed stale user analysis: ${identitiesToAnalyze.length} identities analyzed, ${findings.length} findings emitted`,
            });
        } catch (error) {
            Debug.error({
                module: "Microsoft365StaleUserAnalyzer",
                context: "execute",
                message: `Failed to analyze stale users: ${error}`,
            });
            throw error; // Re-throw so BaseWorker can log it
        }
    }
}
