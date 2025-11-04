import { BaseWorker } from "@workspace/pipeline/workers/base.js";
import { api } from "@workspace/database/convex/_generated/api.js";
import type { Doc, Id } from "@workspace/database/convex/_generated/dataModel.js";
import { client } from "@workspace/shared/lib/convex.js";
import Debug from "@workspace/shared/lib/Debug.js";
import { LinkedEventPayload } from "@workspace/shared/types/pipeline/index.js";

export class Microsoft365MFAAnalyzer extends BaseWorker {
    constructor() {
        // Declare dependencies: identities and policies
        super(["identities", "policies"]);
    }

    protected async execute(event: LinkedEventPayload): Promise<void> {
        const { tenantID, integrationID, integrationType, dataSourceID, entityType, changedEntityIds } = event;

        if (integrationType !== "microsoft-365") return;

        Debug.log({
            module: "Microsoft365MFAAnalyzer",
            context: "execute",
            message: `Analyzing MFA enforcement for tenant ${tenantID}`,
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
                module: "Microsoft365MFAAnalyzer",
                context: "execute",
                message: `Analyzing ${identitiesToAnalyze.length} identities (incremental: ${!!changedEntityIds})`,
            });

            // Check if Security Defaults is enabled
            const securityDefaults = policies.find(
                (p) => p.externalId === "security-defaults"
            );
            const securityDefaultsEnabled = securityDefaults?.normalizedData?.status === "enabled";

            // Find MFA-enforcing Conditional Access policies
            const mfaPolicies = policies.filter((policy) => {
                if (policy.externalId === "security-defaults") return false;

                const rawData = policy.rawData;
                if (!rawData?.grantControls?.builtInControls) return false;

                return rawData.grantControls.builtInControls.includes("mfa") &&
                    policy.normalizedData.status === "enabled";
            });

            // For each identity, check MFA enforcement
            for (const identity of identitiesToAnalyze) {
                const identityTags = identity.normalizedData.tags || [];
                let hasMFA = false;

                // If security defaults enabled, all users have MFA
                if (securityDefaultsEnabled) {
                    hasMFA = true;
                }

                // Check if any MFA policy applies to this identity
                if (!hasMFA && mfaPolicies.length > 0) {
                    for (const policy of mfaPolicies) {
                        const rawData = policy.rawData;
                        const conditions = rawData.conditions;

                        if (!conditions || !conditions.users) continue;

                        const { includeUsers, excludeUsers, includeGroups } = conditions.users;

                        // Check if policy applies to all users
                        if (includeUsers?.includes("All")) {
                            // Check if user is not excluded
                            if (!excludeUsers?.includes(identity.externalId)) {
                                hasMFA = true;
                                break;
                            }
                        }

                        // Check if user is directly included
                        if (includeUsers?.includes(identity.externalId)) {
                            hasMFA = true;
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
                                    hasMFA = true;
                                    break;
                                }
                            }

                            if (hasMFA) break;
                        }
                    }
                }

                // Update identity tags
                if (hasMFA && !identityTags.includes("MFA")) {
                    identityTags.push("MFA");
                    await client.mutation(api.helpers.orm.update_s, {
                        tableName: "entities",
                        secret: process.env.CONVEX_API_KEY!,
                        data: [{
                            id: identity._id,
                            updates: {
                                normalizedData: {
                                    ...identity.normalizedData,
                                    tags: identityTags,
                                },
                                updatedAt: Date.now(),
                            },
                        }],
                    });
                } else if (!hasMFA && identityTags.includes("MFA")) {
                    // Remove MFA tag if no longer enforced
                    const updatedTags = identityTags.filter((t: any) => t !== "MFA");
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
                }

                // Create alert if MFA not enforced
                if (!hasMFA) {
                    // Check if user is an admin (higher severity)
                    const isAdmin = identityTags.includes("Admin");
                    const severity = isAdmin ? "critical" : "high";

                    // Check if alert already exists
                    const existingAlert = await client.query(api.helpers.orm.get_s, {
                        tableName: "entity_alerts",
                        secret: process.env.CONVEX_API_KEY!,
                        index: {
                            name: "by_entity",
                            params: {
                                entityId: identity._id,
                            },
                        },
                        tenantId: tenantID as Id<"tenants">,
                    }) as Doc<"entity_alerts"> | null;

                    const alertExists = existingAlert &&
                        existingAlert.alertType === "mfa_not_enforced" &&
                        existingAlert.status === "active";

                    if (!alertExists) {
                        await client.mutation(api.helpers.orm.insert_s, {
                            tableName: "entity_alerts",
                            secret: process.env.CONVEX_API_KEY!,
                            tenantId: tenantID as Id<"tenants">,
                            data: [{
                                tenantId: tenantID as Id<"tenants">,
                                entityId: identity._id,
                                alertType: "mfa_not_enforced",
                                severity,
                                message: `User ${identity.normalizedData.name} does not have MFA enforcement`,
                                metadata: {
                                    email: identity.normalizedData.email,
                                    isAdmin,
                                    securityDefaultsEnabled,
                                },
                                status: "active",
                                updatedAt: Date.now(),
                            }],
                        });
                    }
                } else {
                    // Resolve any existing MFA alerts
                    const existingAlert = await client.query(api.helpers.orm.get_s, {
                        tableName: "entity_alerts",
                        secret: process.env.CONVEX_API_KEY!,
                        index: {
                            name: "by_entity",
                            params: {
                                entityId: identity._id,
                            },
                        },
                        tenantId: tenantID as Id<"tenants">,
                    }) as Doc<"entity_alerts"> | null;

                    if (
                        existingAlert &&
                        existingAlert.alertType === "mfa_not_enforced" &&
                        existingAlert.status === "active"
                    ) {
                        await client.mutation(api.helpers.orm.update_s, {
                            tableName: "entity_alerts",
                            secret: process.env.CONVEX_API_KEY!,
                            data: [{
                                id: existingAlert._id,
                                updates: {
                                    status: "resolved",
                                    resolvedAt: Date.now(),
                                    updatedAt: Date.now(),
                                },
                            }],
                        });
                    }
                }
            }

            Debug.log({
                module: "Microsoft365MFAAnalyzer",
                context: "execute",
                message: `Completed MFA analysis for ${identitiesToAnalyze.length} identities`,
            });
        } catch (error) {
            Debug.error({
                module: "Microsoft365MFAAnalyzer",
                context: "execute",
                message: `Failed to analyze MFA: ${error}`,
            });
            throw error; // Re-throw so BaseWorker can log it
        }
    }
}
