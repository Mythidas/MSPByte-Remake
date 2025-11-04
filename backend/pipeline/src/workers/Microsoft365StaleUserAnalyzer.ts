import { BaseWorker } from "@workspace/pipeline/workers/base.js";
import { api } from "@workspace/database/convex/_generated/api.js";
import type { Doc, Id } from "@workspace/database/convex/_generated/dataModel.js";
import { client } from "@workspace/shared/lib/convex.js";
import Debug from "@workspace/shared/lib/Debug.js";
import { LinkedEventPayload } from "@workspace/shared/types/pipeline/index.js";

const STALE_THRESHOLD_DAYS = 90;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export class Microsoft365StaleUserAnalyzer extends BaseWorker {
    constructor() {
        // Declare dependencies: only identities
        super(["identities"]);
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
                module: "Microsoft365StaleUserAnalyzer",
                context: "execute",
                message: `Analyzing ${identitiesToAnalyze.length} identities (incremental: ${!!changedEntityIds})`,
            });

            const now = Date.now();

            for (const identity of identitiesToAnalyze) {
                const lastLoginStr = identity.normalizedData.last_login_at;
                const lastLoginDate = new Date(lastLoginStr).getTime();
                const daysSinceLogin = (now - lastLoginDate) / MS_PER_DAY;

                const isStale = daysSinceLogin >= STALE_THRESHOLD_DAYS && lastLoginDate > 0;
                const identityTags = identity.normalizedData.tags || [];
                const enabled = identity.normalizedData.enabled;

                // Update Stale tag
                if (isStale && !identityTags.includes("Stale")) {
                    identityTags.push("Stale");
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
                } else if (!isStale && identityTags.includes("Stale")) {
                    // Remove Stale tag if user is now active
                    const updatedTags = identityTags.filter((t: any) => t !== "Stale");
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

                // Create alert if user is stale
                if (isStale && enabled) {
                    // Check if user has licenses (higher priority)
                    const hasLicenses = identity.normalizedData.licenses?.length > 0;
                    const isAdmin = identityTags.includes("Admin");

                    let severity: "low" | "medium" | "high" = "medium";
                    if (isAdmin) {
                        severity = "high";
                    } else if (!hasLicenses) {
                        severity = "low";
                    }

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
                        existingAlert.alertType === "stale_user" &&
                        existingAlert.status === "active";

                    if (!alertExists) {
                        await client.mutation(api.helpers.orm.insert_s, {
                            tableName: "entity_alerts",
                            secret: process.env.CONVEX_API_KEY!,
                            tenantId: tenantID as Id<"tenants">,
                            data: [{
                                tenantId: tenantID as Id<"tenants">,
                                entityId: identity._id,
                                alertType: "stale_user",
                                severity,
                                message: `User ${identity.normalizedData.name} has been inactive for ${Math.floor(daysSinceLogin)} days`,
                                metadata: {
                                    email: identity.normalizedData.email,
                                    daysInactive: Math.floor(daysSinceLogin),
                                    lastLogin: lastLoginStr,
                                    hasLicenses,
                                    isAdmin,
                                },
                                status: "active",
                                updatedAt: Date.now(),
                            }],
                        });
                    } else {
                        // Update existing alert with current days inactive
                        await client.mutation(api.helpers.orm.update_s, {
                            tableName: "entity_alerts",
                            secret: process.env.CONVEX_API_KEY!,
                            data: [{
                                id: existingAlert._id,
                                updates: {
                                    message: `User ${identity.normalizedData.name} has been inactive for ${Math.floor(daysSinceLogin)} days`,
                                    metadata: {
                                        ...existingAlert.metadata,
                                        daysInactive: Math.floor(daysSinceLogin),
                                    },
                                    updatedAt: Date.now(),
                                },
                            }],
                        });
                    }
                } else if (!isStale || !enabled) {
                    // Resolve any existing stale user alerts
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
                        existingAlert.alertType === "stale_user" &&
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
                module: "Microsoft365StaleUserAnalyzer",
                context: "execute",
                message: `Completed stale user analysis for ${identitiesToAnalyze.length} identities`,
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
