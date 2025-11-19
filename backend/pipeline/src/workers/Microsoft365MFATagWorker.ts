import { BaseWorker } from "@workspace/pipeline/workers/base.js";
import { api } from "@workspace/database/convex/_generated/api.js";
import type { Doc, Id } from "@workspace/database/convex/_generated/dataModel.js";
import { client } from "@workspace/shared/lib/convex.js";
import Debug from "@workspace/shared/lib/Debug.js";
import { LinkedEventPayload } from "@workspace/shared/types/pipeline/index.js";

/**
 * Microsoft 365 MFA Tag Worker
 *
 * Dedicated worker for managing MFA status tags on identities.
 *
 * Responsibilities:
 * - Evaluate MFA enforcement status (Full MFA, Partial MFA, No MFA)
 * - Update identity tags based on MFA status:
 *   - "No MFA" tag for identities with no MFA enforcement
 *   - "Partial MFA" tag for identities with partial MFA enforcement
 *   - No tag for identities with full MFA enforcement
 * - Preserve other tags (e.g., "Admin") during updates
 *
 * Architecture:
 * - Subscribes to linked events for identities and policies
 * - Requires full context (policy changes affect all identities)
 * - Performs batch tag updates for efficiency
 */
export class Microsoft365MFATagWorker extends BaseWorker {
    constructor() {
        // Declare dependencies: identities and policies
        super(["identities", "policies"]);

        // Require full context: Policy changes affect all identities
        this.requiresFullContext = true;
    }

    protected async execute(event: LinkedEventPayload): Promise<void> {
        const { tenantID, integrationID, integrationType, dataSourceID, entityType } = event;

        if (integrationType !== "microsoft-365") return;

        Debug.log({
            module: "Microsoft365MFATagWorker",
            context: "execute",
            message: `Updating MFA tags for tenant ${tenantID}`,
        });

        try {
            // ==================== STEP 1: Fetch all identities ====================
            const allIdentities = await client.query(api.helpers.orm.list_s, {
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

            // Filter out soft-deleted identities
            const identities = allIdentities.filter(identity => !identity.deletedAt);

            Debug.log({
                module: "Microsoft365MFATagWorker",
                context: "execute",
                message: `Processing ${identities.length} identities`,
            });

            if (identities.length === 0) {
                Debug.log({
                    module: "Microsoft365MFATagWorker",
                    context: "execute",
                    message: "No identities to process, skipping execution",
                });
                return;
            }

            // ==================== STEP 2: Fetch policies ====================
            const allPolicies = await client.query(api.helpers.orm.list_s, {
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

            // Check for Security Defaults
            const securityDefaults = allPolicies.find((p) => p.externalId === "security-defaults");
            const securityDefaultsEnabled = securityDefaults?.normalizedData?.status === "enabled";

            // Get MFA-enforcing conditional access policies
            const mfaPolicies = allPolicies.filter((policy) => {
                if (policy.externalId === "security-defaults") return false;
                const grantControls = policy.rawData.grantControls;
                if (!grantControls || !grantControls.builtInControls) return false;
                return grantControls.builtInControls.includes("mfa");
            });

            Debug.log({
                module: "Microsoft365MFATagWorker",
                context: "execute",
                message: `MFA Policy Status: Security Defaults=${securityDefaultsEnabled}, CA Policies=${mfaPolicies.length}`,
            });

            // ==================== STEP 3: Build group membership map ====================
            // Get all group entities
            const allGroups = await client.query(api.helpers.orm.list_s, {
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
                    entityType: "groups"
                }
            }) as Doc<"entities">[];

            // Build identity -> group external IDs map
            const identityGroupMap = new Map<Id<"entities">, string[]>();
            for (const identity of identities) {
                identityGroupMap.set(identity._id, []);
            }

            // Fetch group memberships for each group using by_parent index
            for (const group of allGroups) {
                const memberships = await client.query(api.helpers.orm.list_s, {
                    tableName: "entity_relationships",
                    secret: process.env.CONVEX_API_KEY!,
                    index: {
                        name: "by_parent",
                        params: {
                            parentEntityId: group._id,
                        },
                    },
                    filters: {
                        relationshipType: "member_of"
                    }
                }) as Doc<"entity_relationships">[];

                // Map each member identity to this group's external ID
                for (const membership of memberships) {
                    const groupList = identityGroupMap.get(membership.childEntityId);
                    if (groupList) {
                        groupList.push(group.externalId);
                    }
                }
            }

            // ==================== STEP 4: Evaluate MFA status and prepare tag updates ====================
            const tagUpdates: Array<{ id: Id<"entities">; updates: any }> = [];
            let noMfaTagsAdded = 0;
            let partialMfaTagsAdded = 0;
            let mfaTagsRemoved = 0;

            for (const identity of identities) {
                // Read Admin tag (set by Microsoft365Linker)
                const tags = identity.normalizedData.tags || [];
                const isAdmin = tags.includes("Admin");

                // ==== MFA EVALUATION ====
                let hasMFA = false;
                let isPartial = false;

                // Security Defaults: Full MFA for admins, Partial MFA for non-admins
                if (securityDefaultsEnabled) {
                    hasMFA = true;
                    isPartial = !isAdmin;
                }

                // Conditional Access policies: Check coverage
                if (!hasMFA && mfaPolicies.length > 0) {
                    const userGroupExternalIds = identityGroupMap.get(identity._id) || [];

                    for (const policy of mfaPolicies) {
                        const rawData = policy.rawData;
                        const conditions = rawData.conditions;

                        if (!conditions || !conditions.users) continue;

                        const { includeUsers, excludeUsers, includeGroups } = conditions.users;
                        let policyApplies = false;

                        // Check if user is excluded
                        if (excludeUsers?.includes(identity.externalId)) continue;

                        // Check if policy applies to all users
                        if (includeUsers?.includes("All")) {
                            policyApplies = true;
                        }

                        // Check if user is directly included
                        if (includeUsers?.includes(identity.externalId)) {
                            policyApplies = true;
                        }

                        // Check if user is in an included group
                        if (includeGroups && includeGroups.length > 0) {
                            for (const groupExternalId of userGroupExternalIds) {
                                if (includeGroups.includes(groupExternalId)) {
                                    policyApplies = true;
                                    break;
                                }
                            }
                        }

                        if (policyApplies) {
                            hasMFA = true;

                            // Check if policy covers ALL applications
                            const fullCoverage = conditions.applications?.includeApplications?.includes("All") || false;

                            if (fullCoverage) {
                                isPartial = false;
                                break; // Found full MFA coverage, stop checking
                            } else {
                                // Policy doesn't cover all apps = Partial MFA
                                isPartial = true;
                            }
                        }
                    }
                }

                // ==== UPDATE TAGS ====
                // Prepare updated tags array
                const currentTags = [...(identity.normalizedData.tags || [])];
                const hasNoMfaTag = currentTags.includes("No MFA");
                const hasPartialMfaTag = currentTags.includes("Partial MFA");

                let tagsChanged = false;

                if (!hasMFA) {
                    // No MFA enforcement - add "No MFA" tag, remove "Partial MFA" if present
                    if (!hasNoMfaTag) {
                        currentTags.push("No MFA");
                        tagsChanged = true;
                        noMfaTagsAdded++;
                    }
                    if (hasPartialMfaTag) {
                        const idx = currentTags.indexOf("Partial MFA");
                        if (idx > -1) currentTags.splice(idx, 1);
                        tagsChanged = true;
                        mfaTagsRemoved++;
                    }
                } else if (isPartial) {
                    // Partial MFA enforcement - add "Partial MFA" tag, remove "No MFA" if present
                    if (!hasPartialMfaTag) {
                        currentTags.push("Partial MFA");
                        tagsChanged = true;
                        partialMfaTagsAdded++;
                    }
                    if (hasNoMfaTag) {
                        const idx = currentTags.indexOf("No MFA");
                        if (idx > -1) currentTags.splice(idx, 1);
                        tagsChanged = true;
                        mfaTagsRemoved++;
                    }
                } else {
                    // Full MFA enforcement - remove both MFA tags if present
                    if (hasNoMfaTag) {
                        const idx = currentTags.indexOf("No MFA");
                        if (idx > -1) currentTags.splice(idx, 1);
                        tagsChanged = true;
                        mfaTagsRemoved++;
                    }
                    if (hasPartialMfaTag) {
                        const idx = currentTags.indexOf("Partial MFA");
                        if (idx > -1) currentTags.splice(idx, 1);
                        tagsChanged = true;
                        mfaTagsRemoved++;
                    }
                }

                // Only add to update batch if tags changed
                if (tagsChanged) {
                    tagUpdates.push({
                        id: identity._id,
                        updates: {
                            normalizedData: {
                                ...identity.normalizedData,
                                tags: currentTags,
                            },
                            updatedAt: Date.now(),
                        },
                    });
                }
            }

            // ==================== STEP 5: Batch update tags ====================
            if (tagUpdates.length > 0) {
                await client.mutation(api.helpers.orm.update_s, {
                    tableName: "entities",
                    secret: process.env.CONVEX_API_KEY!,
                    data: tagUpdates,
                });

                Debug.log({
                    module: "Microsoft365MFATagWorker",
                    context: "execute",
                    message: `MFA tag updates: +"No MFA"=${noMfaTagsAdded}, +"Partial MFA"=${partialMfaTagsAdded}, -${mfaTagsRemoved} (${tagUpdates.length} total updates)`,
                });
            } else {
                Debug.log({
                    module: "Microsoft365MFATagWorker",
                    context: "execute",
                    message: "No MFA tag updates needed",
                });
            }

            Debug.log({
                module: "Microsoft365MFATagWorker",
                context: "execute",
                message: `Completed MFA tag processing: ${identities.length} identities evaluated, ${tagUpdates.length} tags updated`,
            });
        } catch (error) {
            Debug.error({
                module: "Microsoft365MFATagWorker",
                context: "execute",
                message: `Failed to update MFA tags: ${error}`,
            });
            throw error;
        }
    }
}
