import { BaseWorker } from "@workspace/pipeline/workers/base.js";
import { api } from "@workspace/database/convex/_generated/api.js";
import type { Doc, Id } from "@workspace/database/convex/_generated/dataModel.js";
import { client } from "@workspace/shared/lib/convex.js";
import Debug from "@workspace/shared/lib/Debug.js";
import { LinkedEventPayload } from "@workspace/shared/types/pipeline/index.js";

export class Microsoft365AdminAnalyzer extends BaseWorker {
    constructor() {
        // Declare dependencies: identities and roles
        super(["identities", "roles"]);

        // Require full context: Role changes require re-analyzing ALL identities
        this.requiresFullContext = true;
    }

    protected async execute(event: LinkedEventPayload): Promise<void> {
        const { tenantID, integrationID, integrationType, dataSourceID, entityType, changedEntityIds } = event;

        if (integrationType !== "microsoft-365") return;

        Debug.log({
            module: "Microsoft365AdminAnalyzer",
            context: "execute",
            message: `Analyzing admin role assignments for tenant ${tenantID}`,
        });

        try {
            // Determine which identities to analyze
            let identitiesToAnalyze: Doc<"entities">[];

            // If roles changed, re-analyze ALL identities (role assignments affect everyone)
            // If only identities changed, analyze only those identities
            if (entityType === "roles" || !changedEntityIds || changedEntityIds.length === 0) {
                // Get all identity entities for this data source
                identitiesToAnalyze = await client.query(api.helpers.orm.list_s, {
                    tableName: "entities",
                    secret: process.env.CONVEX_API_KEY!,
                    index: {
                        name: "by_data_source",
                        params: {
                            dataSourceId: dataSourceID as Id<"data_sources">,
                            tenantId: tenantID as Id<"tenants">,
                        },
                    },
                    filters: {
                        entityType: "identities"
                    }
                }) as Doc<"entities">[];
            } else {
                // Incremental: Only analyze changed identities
                identitiesToAnalyze = [];
                for (const entityId of changedEntityIds) {
                    const identity = await client.query(api.helpers.orm.get_s, {
                        tableName: "entities",
                        id: entityId as Id<"entities">,
                        secret: process.env.CONVEX_API_KEY!,
                    }) as Doc<"entities"> | null;

                    if (identity && identity.entityType === "identities") {
                        identitiesToAnalyze.push(identity);
                    }
                }
            }

            Debug.log({
                module: "Microsoft365AdminAnalyzer",
                context: "execute",
                message: `Analyzing ${identitiesToAnalyze.length} identities (incremental: ${!!changedEntityIds})`,
            });

            // For each identity, check if they have admin role assignments
            for (const identity of identitiesToAnalyze) {
                // Query entity_relationships for assigned_role relationships
                const roleRelationships = await client.query(api.helpers.orm.list_s, {
                    tableName: "entity_relationships",
                    secret: process.env.CONVEX_API_KEY!,
                    index: {
                        name: "by_child",
                        params: {
                            childEntityId: identity._id,
                        },
                    },
                    filters: {
                        relationshipType: "assigned_role"
                    }
                }) as Doc<"entity_relationships">[];

                const hasAdminRole = roleRelationships.length > 0;
                const currentTags = identity.normalizedData.tags || [];
                const hasAdminTag = currentTags.includes("Admin");

                // Update tags if needed
                if (hasAdminRole && !hasAdminTag) {
                    // Add Admin tag
                    currentTags.push("Admin");
                    await client.mutation(api.helpers.orm.update_s, {
                        tableName: "entities",
                        secret: process.env.CONVEX_API_KEY!,
                        data: [{
                            id: identity._id,
                            updates: {
                                normalizedData: {
                                    ...identity.normalizedData,
                                    tags: currentTags,
                                },
                                updatedAt: Date.now(),
                            },
                        }],
                    });

                    Debug.log({
                        module: "Microsoft365AdminAnalyzer",
                        context: "execute",
                        message: `Added Admin tag to identity ${identity._id} (${identity.normalizedData.name})`,
                    });
                } else if (!hasAdminRole && hasAdminTag) {
                    // Remove Admin tag
                    const updatedTags = currentTags.filter((t: any) => t !== "Admin");
                    await client.mutation(api.helpers.orm.update_s, {
                        tableName: "entities",
                        secret: process.env.CONVEX_API_KEY!,
                        data: [{
                            id: identity._id,
                            updates: {
                                normalizedData: {
                                    ...identity.normalizedData,
                                    tags: updatedTags,
                                },
                                updatedAt: Date.now(),
                            },
                        }],
                    });

                    Debug.log({
                        module: "Microsoft365AdminAnalyzer",
                        context: "execute",
                        message: `Removed Admin tag from identity ${identity._id} (${identity.normalizedData.name})`,
                    });
                }

                // Recalculate identity state after tag changes (affects alert severity)
                if (hasAdminRole !== hasAdminTag) {
                    const newState = await this.calculateIdentityState(identity._id, tenantID as Id<"tenants">);
                    await this.updateIdentityState(identity, newState);
                }
            }

            Debug.log({
                module: "Microsoft365AdminAnalyzer",
                context: "execute",
                message: `Completed admin role analysis for ${identitiesToAnalyze.length} identities`,
            });
        } catch (error) {
            Debug.error({
                module: "Microsoft365AdminAnalyzer",
                context: "execute",
                message: `Failed to analyze admin roles: ${error}`,
            });
            throw error; // Re-throw so BaseWorker can log it
        }
    }
}
