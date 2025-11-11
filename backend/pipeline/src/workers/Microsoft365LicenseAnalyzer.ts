import { BaseWorker } from "@workspace/pipeline/workers/base.js";
import { api } from "@workspace/database/convex/_generated/api.js";
import type { Doc, Id } from "@workspace/database/convex/_generated/dataModel.js";
import { client } from "@workspace/shared/lib/convex.js";
import Debug from "@workspace/shared/lib/Debug.js";
import { LinkedEventPayload } from "@workspace/shared/types/pipeline/index.js";

export class Microsoft365LicenseAnalyzer extends BaseWorker {
    constructor() {
        // Declare dependencies: identities and licenses
        super(["identities", "licenses"]);

        // Require full context: License changes require re-analyzing ALL identities
        this.requiresFullContext = true;
    }

    protected async execute(event: LinkedEventPayload): Promise<void> {
        const { tenantID, integrationID, integrationType, dataSourceID, entityType, changedEntityIds } = event;

        if (integrationType !== "microsoft-365") return;

        Debug.log({
            module: "Microsoft365LicenseAnalyzer",
            context: "execute",
            message: `Analyzing license optimization for tenant ${tenantID}`,
        });

        try {
            // Determine which identities to analyze
            let identitiesToAnalyze: Doc<"entities">[];

            // If licenses changed, re-analyze ALL identities (license data affects everyone)
            // If only identities changed, analyze only those identities
            if (entityType === "licenses" || !changedEntityIds || changedEntityIds.length === 0) {
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
                module: "Microsoft365LicenseAnalyzer",
                context: "execute",
                message: `Analyzing ${identitiesToAnalyze.length} identities (incremental: ${!!changedEntityIds})`,
            });

            // Check for licenses assigned to disabled or stale users
            for (const identity of identitiesToAnalyze) {
                const licenses = identity.normalizedData.licenses || [];
                const enabled = identity.normalizedData.enabled;
                const tags = identity.normalizedData.tags || [];
                const isStale = tags.includes("Stale");

                // If user is disabled or stale and has licenses, create alerts
                if ((!enabled || isStale) && licenses.length > 0) {
                    for (const licenseSkuId of licenses) {
                        // Get license entity
                        const license = await client.query(api.helpers.orm.get_s, {
                            tableName: "entities",
                            secret: process.env.CONVEX_API_KEY!,
                            index: {
                                name: "by_external_id",
                                params: {
                                    externalId: licenseSkuId,
                                },
                            },
                            tenantId: tenantID as Id<"tenants">,
                        }) as Doc<"entities"> | null;

                        if (!license || license.entityType !== "licenses") {
                            continue;
                        }

                        const licenseName = license.normalizedData.name;
                        const severity = !enabled ? "medium" : "low";
                        const reason = !enabled ? "disabled" : "stale";

                        // Check if active alert already exists for this entity, type, and license
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
                                alertType: "license_waste"
                            },
                            tenantId: tenantID as Id<"tenants">,
                        }) as Doc<"entity_alerts">[];

                        // Find alert for this specific license
                        const existingAlert = existingAlerts.find(
                            alert => alert.metadata?.licenseSkuId === licenseSkuId
                        );

                        if (existingAlert) {
                            // UPDATE existing alert with fresh metadata
                            await client.mutation(api.helpers.orm.update_s, {
                                tableName: "entity_alerts",
                                secret: process.env.CONVEX_API_KEY!,
                                data: [{
                                    id: existingAlert._id,
                                    updates: {
                                        severity,
                                        message: `License ${licenseName} assigned to ${reason} user ${identity.normalizedData.name}`,
                                        metadata: {
                                            email: identity.normalizedData.email,
                                            licenseSkuId,
                                            licenseName,
                                            reason,
                                            userEnabled: enabled,
                                            userStale: isStale,
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
                                    alertType: "license_waste",
                                    severity,
                                    message: `License ${licenseName} assigned to ${reason} user ${identity.normalizedData.name}`,
                                    metadata: {
                                        email: identity.normalizedData.email,
                                        licenseSkuId,
                                        licenseName,
                                        reason,
                                        userEnabled: enabled,
                                        userStale: isStale,
                                    },
                                    status: "active",
                                    updatedAt: Date.now(),
                                }],
                            });
                        }
                    }
                } else if (enabled && !isStale) {
                    // Resolve any license waste alerts for this active user
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
                            alertType: "license_waste"
                        },
                        tenantId: tenantID as Id<"tenants">,
                    }) as Doc<"entity_alerts">[];

                    for (const alert of existingAlerts) {
                        await client.mutation(api.helpers.orm.update_s, {
                            tableName: "entity_alerts",
                            secret: process.env.CONVEX_API_KEY!,
                            data: [{
                                id: alert._id,
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
                module: "Microsoft365LicenseAnalyzer",
                context: "execute",
                message: `Completed license optimization analysis for ${identitiesToAnalyze.length} identities`,
            });
        } catch (error) {
            Debug.error({
                module: "Microsoft365LicenseAnalyzer",
                context: "execute",
                message: `Failed to analyze license optimization: ${error}`,
            });
            throw error; // Re-throw so BaseWorker can log it
        }
    }
}
