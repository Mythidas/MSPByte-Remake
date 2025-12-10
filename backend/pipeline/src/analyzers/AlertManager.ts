import { ConvexHttpClient } from "convex/browser";
import { api } from "@workspace/database/convex/_generated/api.js";
import { Alert } from "../types.js";
import { Logger } from "../lib/logger.js";
import type { Id } from "@workspace/database/convex/_generated/dataModel";
import type { IntegrationId } from "@workspace/shared/types/integrations";

/**
 * AlertManager - Manages alert lifecycle with deduplication
 *
 * Key responsibilities:
 * 1. Deduplicate alerts using fingerprints
 * 2. Create new alerts
 * 3. Update existing alerts (bump lastSeenAt)
 * 4. Resolve stale alerts (not seen in current sync)
 * 5. Batch all operations for efficiency
 *
 * Deduplication strategy:
 * - Each alert has a unique fingerprint (e.g., "mfa-not-enforced:entityId")
 * - If alert with fingerprint exists: update lastSeenAt
 * - If alert doesn't exist: create new
 * - If existing alert not seen in sync: mark as resolved
 *
 * Performance:
 * - Load all existing alerts for datasource ONCE
 * - Batch create/update/resolve in 3 mutations max
 */
export class AlertManager {
    private convex: ConvexHttpClient;
    private secret: string;

    constructor(convexUrl: string) {
        this.convex = new ConvexHttpClient(convexUrl);

        // Validate CONVEX_API_KEY is set
        this.secret = process.env.CONVEX_API_KEY || "";
        if (!this.secret) {
            throw new Error("CONVEX_API_KEY environment variable is required for AlertManager");
        }
    }

    /**
     * Process alerts with deduplication
     * Returns counts of created, updated, and resolved alerts
     */
    async processAlerts(
        alerts: Alert[],
        tenantId: Id<"tenants">,
        integrationId: IntegrationId,
        dataSourceId: Id<"data_sources">,
        syncId: string
    ): Promise<{ created: number; updated: number; resolved: number }> {
        const now = Date.now();

        Logger.log({
            module: "AlertManager",
            context: "processAlerts",
            message: `Processing ${alerts.length} alerts for datasource ${dataSourceId}`,
            level: "info",
        });

        // STEP 1: Load all existing alerts for this datasource
        const existingAlerts = (await this.convex.query(api.helpers.orm.list_s, {
            tableName: "entity_alerts",
            tenantId,
            secret: this.secret,
            filters: {
                dataSourceId,
            },
        })) as any[];

        Logger.log({
            module: "AlertManager",
            context: "processAlerts",
            message: `Found ${existingAlerts.length} existing alerts`,
            level: "trace",
        });

        // STEP 2: Build fingerprint map for O(1) lookup
        const existingMap = new Map(existingAlerts.map((a) => [a.fingerprint, a]));
        const seenFingerprints = new Set<string>();

        // STEP 3: Categorize alerts
        const toCreate: any[] = [];
        const toUpdate: any[] = [];

        for (const alert of alerts) {
            seenFingerprints.add(alert.fingerprint);
            const existing = existingMap.get(alert.fingerprint);

            if (!existing) {
                // CREATE: New alert
                toCreate.push({
                    integrationId,
                    dataSourceId,
                    entityId: alert.entityId,
                    alertType: alert.alertType,
                    severity: alert.severity,
                    message: alert.message,
                    fingerprint: alert.fingerprint,
                    metadata: alert.metadata,
                    status: "active",
                    lastSeenAt: now,
                    syncId,
                    createdAt: now,
                    updatedAt: now,
                });
            } else {
                // UPDATE: Alert still exists, update lastSeenAt and metadata
                const needsUpdate =
                    existing.status !== "active" ||
                    existing.severity !== alert.severity ||
                    existing.message !== alert.message ||
                    JSON.stringify(existing.metadata) !== JSON.stringify(alert.metadata);

                if (needsUpdate) {
                    toUpdate.push({
                        id: existing._id,
                        updates: {
                            severity: alert.severity,
                            message: alert.message,
                            metadata: alert.metadata,
                            status: "active",
                            lastSeenAt: now,
                            syncId,
                            updatedAt: now,
                        },
                    });
                } else {
                    // Just bump lastSeenAt
                    toUpdate.push({
                        id: existing._id,
                        updates: {
                            lastSeenAt: now,
                            syncId,
                            updatedAt: now,
                        },
                    });
                }
            }
        }

        // STEP 4: Find alerts to resolve (not seen in this sync)
        const toResolve: any[] = [];
        for (const existing of existingAlerts) {
            if (!seenFingerprints.has(existing.fingerprint) && existing.status === "active") {
                toResolve.push({
                    id: existing._id,
                    updates: {
                        status: "resolved",
                        resolvedAt: now,
                        updatedAt: now,
                    },
                });
            }
        }

        Logger.log({
            module: "AlertManager",
            context: "processAlerts",
            message: `Categorized: ${toCreate.length} to create, ${toUpdate.length} to update, ${toResolve.length} to resolve`,
            level: "trace",
        });

        // STEP 5: Execute batch operations (3 mutations max)
        if (toCreate.length > 0) {
            await this.convex.mutation(api.helpers.orm.insert_s, {
                tableName: "entity_alerts",
                tenantId,
                data: toCreate,
                secret: this.secret,
            });

            Logger.log({
                module: "AlertManager",
                context: "processAlerts",
                message: `Created ${toCreate.length} new alerts`,
                level: "trace",
            });
        }

        if (toUpdate.length > 0) {
            await this.convex.mutation(api.helpers.orm.update_s, {
                tableName: "entity_alerts",
                data: toUpdate,
                secret: this.secret,
            });

            Logger.log({
                module: "AlertManager",
                context: "processAlerts",
                message: `Updated ${toUpdate.length} alerts`,
                level: "trace",
            });
        }

        if (toResolve.length > 0) {
            await this.convex.mutation(api.helpers.orm.update_s, {
                tableName: "entity_alerts",
                data: toResolve,
                secret: this.secret,
            });

            Logger.log({
                module: "AlertManager",
                context: "processAlerts",
                message: `Resolved ${toResolve.length} stale alerts`,
                level: "trace",
            });
        }

        const result = {
            created: toCreate.length,
            updated: toUpdate.length,
            resolved: toResolve.length,
        };

        Logger.log({
            module: "AlertManager",
            context: "processAlerts",
            message: `Alert processing complete: ${result.created} created, ${result.updated} updated, ${result.resolved} resolved`,
            level: "info",
        });

        return result;
    }

    /**
     * Get alert summary for a datasource
     */
    async getAlertSummary(
        tenantId: Id<"tenants">,
        dataSourceId: Id<"data_sources">
    ): Promise<{
        total: number;
        active: number;
        resolved: number;
        bySeverity: Record<string, number>;
    }> {
        const alerts = (await this.convex.query(api.helpers.orm.list_s, {
            tableName: "entity_alerts",
            tenantId,
            secret: this.secret,
            filters: {
                dataSourceId,
            },
        })) as any[];

        const active = alerts.filter((a) => a.status === "active");
        const resolved = alerts.filter((a) => a.status === "resolved");

        const bySeverity = active.reduce((acc, alert) => {
            acc[alert.severity] = (acc[alert.severity] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        return {
            total: alerts.length,
            active: active.length,
            resolved: resolved.length,
            bySeverity,
        };
    }
}
