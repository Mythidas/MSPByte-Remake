import { BaseWorker } from "@workspace/pipeline/workers/BaseWorker.js";
import { api } from "@workspace/database/convex/_generated/api.js";
import type { Doc, Id } from "@workspace/database/convex/_generated/dataModel.js";
import { client } from "@workspace/shared/lib/convex.js";
import Debug from "@workspace/shared/lib/Debug.js";
import { LinkedEventPayload } from "@workspace/shared/types/pipeline/index.js";
import { isLicenseOverused, getLicenseOverage } from "@workspace/shared/lib/licenses.js";
import type { License } from "@workspace/database/convex/types/normalized.js";
import type { LicenseFinding } from "@workspace/shared/types/events/analysis.js";

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

            const findings: LicenseFinding[] = [];

            // Check for licenses assigned to disabled or stale users
            for (const identity of identitiesToAnalyze) {
                const licenses = identity.normalizedData.licenses || [];
                const enabled = identity.normalizedData.enabled;
                const tags = identity.normalizedData.tags || [];
                const isStale = tags.includes("Stale");

                // If user is disabled or stale and has licenses, create finding
                if ((!enabled || isStale) && licenses.length > 0) {
                    const severity = !enabled ? "medium" : "low";
                    const reason = !enabled ? "disabled" : "stale";

                    // Batch fetch all license entities for this identity
                    const wastedLicenses: Array<{ licenseSkuId: string; licenseName: string }> = [];

                    for (const licenseSkuId of licenses) {
                        // Get license entity to fetch the license name
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

                        if (license && license.entityType === "licenses") {
                            wastedLicenses.push({
                                licenseSkuId,
                                licenseName: license.normalizedData.name,
                            });
                        }
                    }

                    if (wastedLicenses.length > 0) {
                        findings.push({
                            entityId: identity._id,
                            severity,
                            findings: {
                                wastedLicenses,
                                reason,
                                userEnabled: enabled,
                                userStale: isStale,
                            }
                        });
                    }
                }
                // Note: If enabled && !isStale, no finding is created
                // This signals to AlertManager that any existing alerts should be resolved
            }

            // Emit license waste findings for AlertManager
            Debug.log({
                module: "Microsoft365LicenseAnalyzer",
                context: "execute",
                message: `Emitting license waste analysis: ${findings.length} findings for identities with wasted licenses`,
            });

            await this.emitAnalysis(event, "license", findings);

            // Check for overused licenses (consumed > total)
            const allLicenses = await client.query(api.helpers.orm.list_s, {
                tableName: "entities",
                secret: process.env.CONVEX_API_KEY!,
                index: {
                    name: "by_data_source_type",
                    params: {
                        dataSourceId: dataSourceID,
                        entityType: "licenses",
                    },
                },
                tenantId: tenantID as Id<"tenants">,
            }) as Doc<"entities">[];

            for (const licenseEntity of allLicenses) {
                const license = licenseEntity.normalizedData as License;

                if (isLicenseOverused(license)) {
                    const overage = getLicenseOverage(license);

                    // Check if alert already exists
                    const existingAlert = await client.query(api.helpers.orm.get_s, {
                        tableName: "entity_alerts",
                        secret: process.env.CONVEX_API_KEY!,
                        index: {
                            name: "by_entity_type",
                            params: {
                                entityId: licenseEntity._id,
                                alertType: "license_overuse",
                            },
                        },
                        filters: {
                            status: "active"
                        },
                        tenantId: tenantID as Id<"tenants">,
                    }) as Doc<"entity_alerts"> | null;

                    if (!existingAlert) {
                        // Create new overuse alert
                        await client.mutation(api.helpers.orm.insert_s, {
                            tableName: "entity_alerts",
                            secret: process.env.CONVEX_API_KEY!,
                            tenantId: tenantID,
                            data: [{
                                entityId: licenseEntity._id,
                                siteId: licenseEntity.siteId,
                                integrationId: integrationID,
                                integrationSlug: integrationType,
                                alertType: "license_overuse",
                                severity: "high",
                                status: "active",
                                message: `License ${license.name} is overused: ${license.consumedUnits} consumed / ${license.totalUnits} available`,
                                metadata: {
                                    licenseName: license.name,
                                    licenseSkuId: license.externalId,
                                    consumedUnits: license.consumedUnits,
                                    totalUnits: license.totalUnits,
                                    overage,
                                },
                                updatedAt: Date.now(),
                            }],
                        });

                        Debug.log({
                            module: "Microsoft365LicenseAnalyzer",
                            context: "execute",
                            message: `Created license_overuse alert for ${license.name} (overage: ${overage})`,
                        });
                    }
                } else {
                    // Resolve any existing overuse alerts for this license
                    const existingAlerts = await client.query(api.helpers.orm.list_s, {
                        tableName: "entity_alerts",
                        secret: process.env.CONVEX_API_KEY!,
                        index: {
                            name: "by_entity_status",
                            params: {
                                entityId: licenseEntity._id,
                                status: "active",
                            },
                        },
                        filters: {
                            alertType: "license_overuse"
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
            }

            Debug.log({
                module: "Microsoft365LicenseAnalyzer",
                context: "execute",
                message: `Completed license optimization analysis: ${identitiesToAnalyze.length} identities analyzed, ${findings.length} waste findings emitted, ${allLicenses.length} licenses checked for overuse`,
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
