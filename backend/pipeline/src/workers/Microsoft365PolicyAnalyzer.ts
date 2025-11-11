import { BaseWorker } from "@workspace/pipeline/workers/base.js";
import { api } from "@workspace/database/convex/_generated/api.js";
import type { Doc, Id } from "@workspace/database/convex/_generated/dataModel.js";
import { client } from "@workspace/shared/lib/convex.js";
import Debug from "@workspace/shared/lib/Debug.js";
import { LinkedEventPayload } from "@workspace/shared/types/pipeline/index.js";

export class Microsoft365PolicyAnalyzer extends BaseWorker {
    constructor() {
        // Declare dependencies: identities and policies
        super(["identities", "policies"]);

        // Require full context: Policy changes require re-analyzing ALL identities
        this.requiresFullContext = true;
    }

    protected async execute(event: LinkedEventPayload): Promise<void> {
        const { tenantID, integrationID, integrationType, dataSourceID, entityType, changedEntityIds } = event;

        if (integrationType !== "microsoft-365") return;

        Debug.log({
            module: "Microsoft365PolicyAnalyzer",
            context: "execute",
            message: `Analyzing policy coverage for tenant ${tenantID}`,
        });

        try {
            // Get all policies for this data source
            const policies = await client.query(api.helpers.orm.list_s, {
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
                    entityType: "policies"
                }
            }) as Doc<"entities">[];

            // Determine which identities to analyze
            let identitiesToAnalyze: Doc<"entities">[];

            // If policy changed, re-analyze ALL identities (policy affects everyone)
            // If only identities changed, analyze only those identities
            if (entityType === "policies" || !changedEntityIds || changedEntityIds.length === 0) {
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
                module: "Microsoft365PolicyAnalyzer",
                context: "execute",
                message: `Analyzing ${identitiesToAnalyze.length} identities (incremental: ${!!changedEntityIds})`,
            });

            // Check if Security Defaults is enabled
            const securityDefaults = policies.find(
                (p) => p.externalId === "security-defaults"
            );
            const securityDefaultsEnabled = securityDefaults?.normalizedData?.status === "enabled";

            // Get enabled policies (exclude security-defaults and disabled policies)
            const enabledPolicies = policies.filter(
                (p) =>
                    p.externalId !== "security-defaults" &&
                    p.normalizedData.status === "enabled"
            );

            // For each identity, check if they're covered by any policy
            for (const identity of identitiesToAnalyze) {
                let coveredByPolicy = false;

                // If security defaults enabled, all users are covered
                if (securityDefaultsEnabled) {
                    coveredByPolicy = true;
                }

                // Check if user is covered by any conditional access policy
                if (!coveredByPolicy) {
                    for (const policy of enabledPolicies) {
                        const rawData = policy.rawData;
                        const conditions = rawData.conditions;

                        if (!conditions || !conditions.users) continue;

                        const { includeUsers, excludeUsers, includeGroups } = conditions.users;

                        // Check if policy includes "All" users
                        if (includeUsers?.includes("All")) {
                            // Check if user is not excluded
                            if (!excludeUsers?.includes(identity.externalId)) {
                                coveredByPolicy = true;
                                break;
                            }
                        }

                        // Check if user is directly included
                        if (includeUsers?.includes(identity.externalId)) {
                            coveredByPolicy = true;
                            break;
                        }

                        // Check if user is in an included group
                        if (includeGroups && includeGroups.length > 0) {
                            const userGroups = (await client.query(api.helpers.orm.list_s, {
                                tableName: "entity_relationships",
                                secret: process.env.CONVEX_API_KEY!,
                                index: {
                                    name: "by_child",
                                    params: {
                                        childEntityId: identity._id,
                                    },
                                },
                                filters: {
                                    relationshipType: "member_of"
                                }
                            })) as Doc<"entity_relationships">[];

                            for (const userGroup of userGroups) {
                                const group = await client.query(api.helpers.orm.get_s, {
                                    tableName: "entities",
                                    id: userGroup.parentEntityId,
                                    secret: process.env.CONVEX_API_KEY!
                                }) as Doc<"entities">;

                                if (group && includeGroups.includes(group.externalId)) {
                                    coveredByPolicy = true;
                                    break;
                                }
                            }

                            if (coveredByPolicy) break;
                        }
                    }
                }

                const tags = identity.normalizedData.tags || [];
                const isAdmin = tags.includes("Admin");

                // Create alert if user has no policy coverage
                if (!coveredByPolicy) {
                    const severity = isAdmin ? "high" : "medium";

                    // Check if active alert already exists for this entity and type
                    const existingAlerts = await client.query(api.helpers.orm.list_s, {
                        tableName: "entity_alerts",
                        secret: process.env.CONVEX_API_KEY!,
                        index: {
                            name: "by_entity_status",
                            params: {
                                entityId: identity._id,
                                status: "active",
                            },
                        },
                        filters: {
                            alertType: "policy_gap"
                        },
                        tenantId: tenantID as Id<"tenants">,
                    }) as Doc<"entity_alerts">[];

                    if (existingAlerts.length > 0) {
                        // UPDATE existing alert with fresh metadata
                        await client.mutation(api.helpers.orm.update_s, {
                            tableName: "entity_alerts",
                            secret: process.env.CONVEX_API_KEY!,
                            data: [{
                                id: existingAlerts[0]._id,
                                updates: {
                                    severity,
                                    message: `User ${identity.normalizedData.name} is not covered by any security policy`,
                                    metadata: {
                                        email: identity.normalizedData.email,
                                        isAdmin,
                                        securityDefaultsEnabled,
                                        enabledPolicyCount: enabledPolicies.length,
                                    },
                                    updatedAt: Date.now(),
                                },
                            }],
                        });
                    } else {
                        // INSERT new alert
                        await client.mutation(api.helpers.orm.insert_s, {
                            tableName: "entity_alerts",
                            secret: process.env.CONVEX_API_KEY!,
                            tenantId: tenantID as Id<"tenants">,
                            data: [{
                                tenantId: tenantID as Id<"tenants">,
                                entityId: identity._id,
                                dataSourceId: dataSourceID,
                                integrationId: integrationID,
                                integrationSlug: integrationType,
                                siteId: identity.siteId,
                                alertType: "policy_gap",
                                severity,
                                message: `User ${identity.normalizedData.name} is not covered by any security policy`,
                                metadata: {
                                    email: identity.normalizedData.email,
                                    isAdmin,
                                    securityDefaultsEnabled,
                                    enabledPolicyCount: enabledPolicies.length,
                                },
                                status: "active",
                                updatedAt: Date.now(),
                            }],
                        });
                    }
                } else {
                    // Resolve any existing policy gap alerts
                    const existingAlerts = await client.query(api.helpers.orm.list_s, {
                        tableName: "entity_alerts",
                        secret: process.env.CONVEX_API_KEY!,
                        index: {
                            name: "by_entity_status",
                            params: {
                                entityId: identity._id,
                                status: "active",
                            },
                        },
                        filters: {
                            alertType: "policy_gap"
                        },
                        tenantId: tenantID as Id<"tenants">,
                    }) as Doc<"entity_alerts">[];

                    if (existingAlerts.length > 0) {
                        await client.mutation(api.helpers.orm.update_s, {
                            tableName: "entity_alerts",
                            secret: process.env.CONVEX_API_KEY!,
                            data: [{
                                id: existingAlerts[0]._id,
                                updates: {
                                    status: "resolved",
                                    resolvedAt: Date.now(),
                                    updatedAt: Date.now(),
                                },
                            }],
                        });
                    }
                }

                // Recalculate identity state after alert operations
                const newState = await this.calculateIdentityState(identity._id, tenantID as Id<"tenants">);
                await this.updateIdentityState(identity, newState);
            }

            Debug.log({
                module: "Microsoft365PolicyAnalyzer",
                context: "execute",
                message: `Completed policy coverage analysis for ${identitiesToAnalyze.length} identities`,
            });
        } catch (error) {
            Debug.error({
                module: "Microsoft365PolicyAnalyzer",
                context: "execute",
                message: `Failed to analyze policy coverage: ${error}`,
            });
            throw error; // Re-throw so BaseWorker can log it
        }
    }
}
