import { BaseWorker } from "@workspace/pipeline/workers/base.js";
import { api } from "@workspace/database/convex/_generated/api.js";
import type { Doc, Id } from "@workspace/database/convex/_generated/dataModel.js";
import { client } from "@workspace/shared/lib/convex.js";
import Debug from "@workspace/shared/lib/Debug.js";
import { LinkedEventPayload } from "@workspace/shared/types/pipeline/index.js";
import type { MFAFinding } from "@workspace/shared/types/events/analysis.js";

/**
 * Microsoft 365 Identity Security Analyzer
 *
 * Simplified analyzer that evaluates MFA enforcement and emits findings.
 *
 * Responsibilities:
 * - Evaluate MFA enforcement status (Full MFA, Partial MFA, No MFA)
 * - Emit findings for identities with MFA issues
 *
 * Tag Management (handled elsewhere):
 * - Admin tag: Computed by Microsoft365Linker after role linking
 * - MFA/Partial MFA tags: Removed - alerts provide this information
 */
export class Microsoft365IdentitySecurityAnalyzer extends BaseWorker {
    constructor() {
        // Declare dependencies: identities and policies
        // Note: Admin tag already computed by Linker, so no role dependency
        super(["identities", "policies"]);

        // Require full context: Policy changes affect all identities
        this.requiresFullContext = true;
    }

    protected async execute(event: LinkedEventPayload): Promise<void> {
        const { tenantID, integrationID, integrationType, dataSourceID, entityType, changedEntityIds } = event;

        if (integrationType !== "microsoft-365") return;

        Debug.log({
            module: "Microsoft365IdentitySecurityAnalyzer",
            context: "execute",
            message: `Analyzing MFA enforcement for tenant ${tenantID}`,
        });

        try {
            // ==================== STEP 1: Fetch all identities ====================
            let identitiesToAnalyze: Doc<"entities">[];

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
                module: "Microsoft365IdentitySecurityAnalyzer",
                context: "execute",
                message: `Analyzing ${identitiesToAnalyze.length} identities (incremental: ${!!changedEntityIds})`,
            });

            if (identitiesToAnalyze.length === 0) {
                Debug.log({
                    module: "Microsoft365IdentitySecurityAnalyzer",
                    context: "execute",
                    message: "No identities to analyze, skipping execution",
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
                module: "Microsoft365IdentitySecurityAnalyzer",
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
            for (const identity of identitiesToAnalyze) {
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

            // ==================== STEP 4: Process each identity ====================
            const findings: MFAFinding[] = [];

            for (const identity of identitiesToAnalyze) {
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

                // ==== CREATE FINDINGS ====
                // Only create findings for identities with MFA issues
                if (!hasMFA) {
                    // No MFA enforcement at all
                    const severity = isAdmin ? "critical" : "high";
                    findings.push({
                        entityId: identity._id,
                        severity,
                        findings: {
                            hasMFA: false,
                            isPartial: false,
                            reason: "No MFA enforcement configured",
                        }
                    });
                } else if (isPartial) {
                    // Partial MFA enforcement
                    const severity = isAdmin ? "high" : "medium";
                    const reason = securityDefaultsEnabled
                        ? "Security Defaults provides MFA but not for all scenarios"
                        : "Conditional Access policy doesn't cover all applications";

                    findings.push({
                        entityId: identity._id,
                        severity,
                        findings: {
                            hasMFA: true,
                            isPartial: true,
                            reason,
                        }
                    });
                }
                // Note: If hasMFA && !isPartial, no finding is created (full MFA = no issue)
            }

            // ==================== STEP 5: Emit findings ====================
            Debug.log({
                module: "Microsoft365IdentitySecurityAnalyzer",
                context: "execute",
                message: `Emitting MFA analysis: ${findings.length} findings for identities with MFA issues`,
            });

            await this.emitAnalysis(event, "mfa", findings);

            Debug.log({
                module: "Microsoft365IdentitySecurityAnalyzer",
                context: "execute",
                message: `Completed MFA analysis: ${identitiesToAnalyze.length} identities analyzed, ${findings.length} findings emitted`,
            });
        } catch (error) {
            Debug.error({
                module: "Microsoft365IdentitySecurityAnalyzer",
                context: "execute",
                message: `Failed to analyze MFA enforcement: ${error}`,
            });
            throw error;
        }
    }
}
