import { natsClient } from "@workspace/pipeline/helpers/nats.js";
import { client } from "@workspace/shared/lib/convex.js";
import { api } from "@workspace/database/convex/_generated/api.js";
import type { Doc, Id } from "@workspace/database/convex/_generated/dataModel.js";
import Debug from "@workspace/shared/lib/Debug.js";
import type { AnalysisEvent, EntityFinding } from "@workspace/shared/types/events/analysis.js";

/**
 * AlertManager - Aggregates analysis from multiple workers and creates composite alerts
 *
 * Architecture:
 * 1. Workers emit analysis.{type}.{entityType} events with findings
 * 2. AlertManager subscribes to analysis.* and aggregates by entity
 * 3. After aggregation window, creates alerts and updates identity states
 * 4. Eliminates race conditions by being single source of truth for alerts/states
 */
export class AlertManager {
    private analysisCache = new Map<string, Map<string, AnalysisEvent>>();
    private aggregationTimers = new Map<string, NodeJS.Timeout>();
    private aggregationWindow = 30000; // 30 seconds to wait for all workers

    async start(): Promise<void> {
        Debug.log({
            module: "AlertManager",
            context: "start",
            message: "Starting AlertManager...",
        });

        await natsClient.subscribe("analysis.>", this.handleAnalysis.bind(this));

        Debug.log({
            module: "AlertManager",
            context: "start",
            message: "AlertManager started, subscribed to analysis.> events",
        });
    }

    /**
     * Handle incoming analysis event from a worker
     */
    private async handleAnalysis(event: AnalysisEvent): Promise<void> {
        const cacheKey = `${event.tenantID}-${event.dataSourceID}`;

        Debug.log({
            module: "AlertManager",
            context: "handleAnalysis",
            message: `Received ${event.analysisType} analysis for ${event.findings.length} entities`,
        });

        // Initialize cache for this tenant+dataSource if needed
        if (!this.analysisCache.has(cacheKey)) {
            this.analysisCache.set(cacheKey, new Map());
        }

        const cache = this.analysisCache.get(cacheKey)!;
        cache.set(event.analysisType, event);

        // Clear existing aggregation timer
        if (this.aggregationTimers.has(cacheKey)) {
            clearTimeout(this.aggregationTimers.get(cacheKey)!);
        }

        // Set new aggregation timer
        const timer = setTimeout(async () => {
            await this.processAggregatedAnalysis(cacheKey);
        }, this.aggregationWindow);

        this.aggregationTimers.set(cacheKey, timer);

        Debug.log({
            module: "AlertManager",
            context: "handleAnalysis",
            message: `Cached ${event.analysisType} analysis. Total cached analyses: ${cache.size}. Aggregation scheduled in ${this.aggregationWindow}ms`,
        });
    }

    /**
     * Process aggregated analysis after all workers have reported
     */
    private async processAggregatedAnalysis(cacheKey: string): Promise<void> {
        const cache = this.analysisCache.get(cacheKey);
        if (!cache || cache.size === 0) {
            return;
        }

        const analyses = Array.from(cache.values());
        const firstAnalysis = analyses[0];

        Debug.log({
            module: "AlertManager",
            context: "processAggregatedAnalysis",
            message: `Processing ${cache.size} aggregated analyses for tenant ${firstAnalysis.tenantID}`,
        });

        try {
            // Group findings by entity
            const entitiesFindingsMap = new Map<Id<"entities">, EntityFinding[]>();

            for (const analysis of analyses) {
                for (const finding of analysis.findings) {
                    if (!entitiesFindingsMap.has(finding.entityId)) {
                        entitiesFindingsMap.set(finding.entityId, []);
                    }
                    entitiesFindingsMap.get(finding.entityId)!.push(finding);
                }
            }

            Debug.log({
                module: "AlertManager",
                context: "processAggregatedAnalysis",
                message: `Aggregated findings for ${entitiesFindingsMap.size} entities`,
            });

            // Process each entity's aggregated findings
            let alertsCreated = 0;
            let alertsUpdated = 0;
            let alertsResolved = 0;

            for (const [entityId, findings] of entitiesFindingsMap) {
                const result = await this.processEntityFindings(
                    entityId,
                    findings,
                    firstAnalysis
                );
                alertsCreated += result.created;
                alertsUpdated += result.updated;
                alertsResolved += result.resolved;
            }

            Debug.log({
                module: "AlertManager",
                context: "processAggregatedAnalysis",
                message: `Alert operations: ${alertsCreated} created, ${alertsUpdated} updated, ${alertsResolved} resolved`,
            });

            // Update identity states for all affected entities
            await this.updateIdentityStates(
                Array.from(entitiesFindingsMap.keys()),
                firstAnalysis.tenantID as Id<"tenants">
            );

            Debug.log({
                module: "AlertManager",
                context: "processAggregatedAnalysis",
                message: `Completed processing ${entitiesFindingsMap.size} entities`,
            });
        } catch (error) {
            Debug.error({
                module: "AlertManager",
                context: "processAggregatedAnalysis",
                message: `Failed to process aggregated analysis: ${error}`,
            });
        } finally {
            // Clear cache and timer
            this.analysisCache.delete(cacheKey);
            this.aggregationTimers.delete(cacheKey);
        }
    }

    /**
     * Process findings for a single entity and create/update alerts
     */
    private async processEntityFindings(
        entityId: Id<"entities">,
        findings: EntityFinding[],
        analysisContext: AnalysisEvent
    ): Promise<{ created: number; updated: number; resolved: number }> {
        let created = 0;
        let updated = 0;
        let resolved = 0;

        // Fetch the entity to get siteId
        const entity = await client.query(api.helpers.orm.get_s, {
            tableName: "entities",
            id: entityId,
            secret: process.env.CONVEX_API_KEY!,
        }) as Doc<"entities"> | null;

        if (!entity) {
            Debug.error({
                module: "AlertManager",
                context: "processEntityFindings",
                message: `Entity ${entityId} not found, skipping alert processing`,
            });
            return { created: 0, updated: 0, resolved: 0 };
        }

        // Determine which alerts should exist based on findings
        const expectedAlerts = new Set<string>();

        for (const finding of findings) {
            // Extract alert types from findings
            const alertTypes = this.determineAlertTypes(finding);
            alertTypes.forEach(type => expectedAlerts.add(type));
        }

        // Get existing active alerts for this entity
        const existingAlerts = await client.query(api.helpers.orm.list_s, {
            tableName: "entity_alerts",
            secret: process.env.CONVEX_API_KEY!,
            index: {
                name: "by_entity_status",
                params: {
                    entityId,
                    status: "active",
                },
            },
            tenantId: analysisContext.tenantID as Id<"tenants">,
        }) as Doc<"entity_alerts">[];

        // Create/update expected alerts
        for (const alertType of expectedAlerts) {
            // Normalize alertType and extract metadata (e.g., license_waste:skuId -> license_waste)
            const normalizedType = alertType.split(":")[0];
            const alertSubId = alertType.includes(":") ? alertType.split(":")[1] : undefined;

            // Find existing alert - for license_waste, match by both type and licenseSkuId in metadata
            const existing = existingAlerts.find(a => {
                if (a.alertType !== normalizedType) return false;
                if (alertSubId && normalizedType === "license_waste") {
                    return a.metadata?.licenseSkuId === alertSubId;
                }
                return true;
            });

            const finding = findings.find(f => this.determineAlertTypes(f).includes(alertType));

            if (!finding) continue;

            // Build metadata with entity information and finding details
            const metadata: Record<string, any> = {
                ...finding.findings,
                email: entity.normalizedData.email || entity.normalizedData.name,
                name: entity.normalizedData.name,
            };

            // Add licenseSkuId for license_waste alerts
            if (alertSubId && normalizedType === "license_waste") {
                metadata.licenseSkuId = alertSubId;
            }

            if (existing) {
                // Update existing alert
                const message = this.generateAlertMessage(alertType, finding, entity);
                await client.mutation(api.helpers.orm.update_s, {
                    tableName: "entity_alerts",
                    secret: process.env.CONVEX_API_KEY!,
                    data: [{
                        id: existing._id,
                        updates: {
                            severity: finding.severity,
                            message,
                            metadata,
                            updatedAt: Date.now(),
                        },
                    }],
                });
                updated++;
            } else {
                // Create new alert
                const message = this.generateAlertMessage(alertType, finding, entity);
                await client.mutation(api.helpers.orm.insert_s, {
                    tableName: "entity_alerts",
                    secret: process.env.CONVEX_API_KEY!,
                    tenantId: analysisContext.tenantID as Id<"tenants">,
                    data: [{
                        tenantId: analysisContext.tenantID as Id<"tenants">,
                        entityId,
                        dataSourceId: analysisContext.dataSourceID,
                        integrationId: analysisContext.integrationID,
                        integrationSlug: analysisContext.integrationType,
                        siteId: entity.siteId,
                        alertType: normalizedType,
                        severity: finding.severity,
                        message,
                        metadata,
                        status: "active",
                        updatedAt: Date.now(),
                    }],
                });
                created++;
            }
        }

        // Resolve alerts that should no longer exist
        for (const existing of existingAlerts) {
            // For license_waste, check if the specific license is in expected alerts
            let shouldResolve = false;
            if (existing.alertType === "license_waste" && existing.metadata?.licenseSkuId) {
                const expectedKey = `license_waste:${existing.metadata.licenseSkuId}`;
                shouldResolve = !expectedAlerts.has(expectedKey);
            } else {
                shouldResolve = !expectedAlerts.has(existing.alertType);
            }

            if (shouldResolve) {
                await client.mutation(api.helpers.orm.update_s, {
                    tableName: "entity_alerts",
                    secret: process.env.CONVEX_API_KEY!,
                    data: [{
                        id: existing._id,
                        updates: {
                            status: "resolved",
                            resolvedAt: Date.now(),
                            updatedAt: Date.now(),
                        },
                    }],
                });
                resolved++;
            }
        }

        return { created, updated, resolved };
    }

    /**
     * Determine which alert types should be created from a finding
     */
    private determineAlertTypes(finding: EntityFinding): string[] {
        const alerts: string[] = [];

        // MFA findings
        if ('hasMFA' in finding.findings) {
            const mfaFinding = finding.findings as any;
            if (!mfaFinding.hasMFA) {
                alerts.push("mfa_not_enforced");
            } else if (mfaFinding.isPartial) {
                alerts.push("mfa_partial_enforced");
            }
        }

        // Stale user findings
        if ('isStale' in finding.findings) {
            const staleFinding = finding.findings as any;
            if (staleFinding.isStale) {
                alerts.push("stale_user");
            }
        }

        // License findings - can have multiple wasted licenses per identity
        if ('wastedLicenses' in finding.findings) {
            const licenseFinding = finding.findings as any;
            // Create separate alert for each wasted license
            for (const license of licenseFinding.wastedLicenses || []) {
                alerts.push(`license_waste:${license.licenseSkuId}`);
            }
        }

        // Policy findings
        if ('missingPolicies' in finding.findings) {
            const policyFinding = finding.findings as any;
            if (policyFinding.missingPolicies && policyFinding.missingPolicies.length > 0) {
                alerts.push("policy_gap");
            }
        }

        return alerts;
    }

    /**
     * Generate human-readable alert message
     */
    private generateAlertMessage(alertType: string, finding: EntityFinding, entity: Doc<"entities">): string {
        const userName = entity.normalizedData.name || entity.normalizedData.email || "Unknown user";

        // Handle license waste with specific license ID
        if (alertType.startsWith("license_waste:")) {
            const licenseSkuId = alertType.split(":")[1];
            const licenseFinding = finding.findings as any;
            const license = licenseFinding.wastedLicenses?.find((l: any) => l.licenseSkuId === licenseSkuId);
            const reason = licenseFinding.reason === "disabled" ? "disabled" : "stale";
            return license
                ? `License ${license.licenseName} assigned to ${reason} user ${userName}`
                : `User ${userName} has unused license`;
        }

        switch (alertType) {
            case "mfa_not_enforced":
                return `User ${userName} does not have MFA enforcement`;
            case "mfa_partial_enforced":
                return `User ${userName} has partial MFA enforcement`;
            case "stale_user":
                return `User ${userName} has been inactive for ${(finding.findings as any).daysSinceLogin} days`;
            case "policy_gap":
                return `User ${userName} is missing required policy assignments`;
            default:
                return `Alert: ${alertType}`;
        }
    }

    /**
     * Update identity states based on active alerts
     */
    private async updateIdentityStates(
        entityIds: Id<"entities">[],
        tenantID: Id<"tenants">
    ): Promise<void> {
        Debug.log({
            module: "AlertManager",
            context: "updateIdentityStates",
            message: `Updating states for ${entityIds.length} identities`,
        });

        let statesUpdated = 0;

        for (const entityId of entityIds) {
            const identity = await client.query(api.helpers.orm.get_s, {
                tableName: "entities",
                id: entityId,
                secret: process.env.CONVEX_API_KEY!,
            }) as Doc<"entities"> | null;

            if (!identity || identity.entityType !== "identities") {
                continue;
            }

            const newState = await this.calculateIdentityState(entityId, tenantID);
            const currentState = (identity.normalizedData as any).state;

            if (currentState !== newState) {
                await client.mutation(api.helpers.orm.update_s, {
                    tableName: "entities",
                    secret: process.env.CONVEX_API_KEY!,
                    data: [{
                        id: entityId,
                        updates: {
                            normalizedData: {
                                ...identity.normalizedData,
                                state: newState,
                            },
                            updatedAt: Date.now(),
                        },
                    }],
                });

                Debug.log({
                    module: "AlertManager",
                    context: "updateIdentityStates",
                    message: `Updated identity ${entityId} state: ${currentState || 'undefined'} → ${newState}`,
                });

                statesUpdated++;
            }
        }

        Debug.log({
            module: "AlertManager",
            context: "updateIdentityStates",
            message: `State update complete: ${statesUpdated} identities changed`,
        });
    }

    /**
     * Calculate identity state based on active alerts
     */
    private async calculateIdentityState(
        entityId: Id<"entities">,
        tenantID: Id<"tenants">
    ): Promise<"normal" | "low" | "warn" | "critical"> {
        try {
            const alerts = await client.query(api.helpers.orm.list_s, {
                tableName: "entity_alerts",
                secret: process.env.CONVEX_API_KEY!,
                index: {
                    name: "by_entity_status",
                    params: {
                        entityId,
                        status: "active",
                    },
                },
                tenantId: tenantID,
            }) as Doc<"entity_alerts">[];

            // Check for critical or high severity alerts
            const hasCriticalOrHigh = alerts.some(
                alert => alert.severity === "critical" || alert.severity === "high"
            );
            if (hasCriticalOrHigh) {
                return "critical";
            }

            // Check for medium severity alerts
            const hasMedium = alerts.some(alert => alert.severity === "medium");
            if (hasMedium) {
                return "warn";
            }

            // Check for low severity alerts
            const hasLow = alerts.some(alert => alert.severity === "low");
            if (hasLow) {
                return "low";
            }

            return "normal";
        } catch (error) {
            Debug.error({
                module: "AlertManager",
                context: "calculateIdentityState",
                message: `Failed to calculate state: ${error}`,
            });
            return "normal";
        }
    }
}
