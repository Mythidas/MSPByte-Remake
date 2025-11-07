import { v } from "convex/values";
import { mutation, MutationCtx, internalMutation } from "../_generated/server.js";
import { isAuthenticated, isValidSecret } from "../helpers/validators.js";

/**
 * Upsert a metric value
 * 
 * Creates or updates a metric record with the provided value.
 * Use this for absolute values (e.g., setting total count to 42).
 * 
 * @example
 * await upsertMetric({
 *   siteId: "site_123",
 *   metricType: "alert_severity",
 *   metricKey: "critical",
 *   value: 5
 * });
 */
export const upsertMetric = mutation({
    args: {
        siteId: v.optional(v.id("sites")),
        dataSourceId: v.optional(v.id("data_sources")),
        metricType: v.string(),
        metricKey: v.string(),
        value: v.number(),
        metadata: v.optional(v.any()),
    },
    handler: async (ctx: MutationCtx, args) => {
        const identity = await isAuthenticated(ctx);

        // Find existing metric
        const existing = await ctx.db
            .query("entity_metrics")
            .withIndex("by_site_type_key", (q) =>
                q
                    .eq("siteId", args.siteId)
                    .eq("metricType", args.metricType)
                    .eq("metricKey", args.metricKey)
                    .eq("tenantId", identity.tenantId)
            )
            .first();

        const now = Date.now();

        if (existing) {
            // Update existing metric
            await ctx.db.patch(existing._id, {
                value: args.value,
                metadata: args.metadata,
                updatedAt: now,
            });
            return existing._id;
        } else {
            // Create new metric
            return await ctx.db.insert("entity_metrics", {
                tenantId: identity.tenantId,
                siteId: args.siteId,
                dataSourceId: args.dataSourceId,
                metricType: args.metricType,
                metricKey: args.metricKey,
                value: args.value,
                metadata: args.metadata,
                updatedAt: now,
            });
        }
    },
});

/**
 * Increment/decrement a metric value
 * 
 * Atomically adds/subtracts from an existing metric.
 * Use this for relative changes (e.g., +1 when alert created, -1 when resolved).
 * If metric doesn't exist, creates it with the delta as initial value.
 * 
 * @example
 * // Increment critical alert count
 * await incrementMetric({
 *   siteId: "site_123",
 *   metricType: "alert_severity",
 *   metricKey: "critical",
 *   delta: 1
 * });
 * 
 * @example
 * // Decrement when alert resolved
 * await incrementMetric({
 *   siteId: "site_123",
 *   metricType: "alert_severity",
 *   metricKey: "critical",
 *   delta: -1
 * });
 */
export const incrementMetric = mutation({
    args: {
        siteId: v.optional(v.id("sites")),
        dataSourceId: v.optional(v.id("data_sources")),
        metricType: v.string(),
        metricKey: v.string(),
        delta: v.number(),
        metadata: v.optional(v.any()),
    },
    handler: async (ctx: MutationCtx, args) => {
        const identity = await isAuthenticated(ctx);

        // Find existing metric
        const existing = await ctx.db
            .query("entity_metrics")
            .withIndex("by_site_type_key", (q) =>
                q
                    .eq("siteId", args.siteId)
                    .eq("metricType", args.metricType)
                    .eq("metricKey", args.metricKey)
                    .eq("tenantId", identity.tenantId)
            )
            .first();

        const now = Date.now();

        if (existing) {
            // Increment existing metric (ensure it doesn't go below 0)
            const newValue = Math.max(0, existing.value + args.delta);
            await ctx.db.patch(existing._id, {
                value: newValue,
                metadata: args.metadata ?? existing.metadata,
                updatedAt: now,
            });
            return existing._id;
        } else {
            // Create new metric with delta as initial value (ensure non-negative)
            const initialValue = Math.max(0, args.delta);
            return await ctx.db.insert("entity_metrics", {
                tenantId: identity.tenantId,
                siteId: args.siteId,
                dataSourceId: args.dataSourceId,
                metricType: args.metricType,
                metricKey: args.metricKey,
                value: initialValue,
                metadata: args.metadata,
                updatedAt: now,
            });
        }
    },
});

/**
 * Batch upsert multiple metrics at once
 * 
 * Efficiently updates multiple metrics in a single mutation.
 * Use this when recalculating all metrics for a site/data source.
 * 
 * @example
 * await batchUpsertMetrics({
 *   siteId: "site_123",
 *   metrics: [
 *     { metricType: "alert_severity", metricKey: "critical", value: 5 },
 *     { metricType: "alert_severity", metricKey: "high", value: 12 },
 *     { metricType: "agent_status", metricKey: "online", value: 45 },
 *   ]
 * });
 */
export const batchUpsertMetrics = mutation({
    args: {
        siteId: v.optional(v.id("sites")),
        dataSourceId: v.optional(v.id("data_sources")),
        metrics: v.array(
            v.object({
                metricType: v.string(),
                metricKey: v.string(),
                value: v.number(),
                metadata: v.optional(v.any()),
            })
        ),
    },
    handler: async (ctx: MutationCtx, args) => {
        const identity = await isAuthenticated(ctx);
        const now = Date.now();

        const results = [];

        for (const metric of args.metrics) {
            // Find existing metric
            const existing = await ctx.db
                .query("entity_metrics")
                .withIndex("by_site_type_key", (q) =>
                    q
                        .eq("siteId", args.siteId)
                        .eq("metricType", metric.metricType)
                        .eq("metricKey", metric.metricKey)
                        .eq("tenantId", identity.tenantId)
                )
                .first();

            if (existing) {
                // Update existing metric
                await ctx.db.patch(existing._id, {
                    value: metric.value,
                    metadata: metric.metadata,
                    updatedAt: now,
                });
                results.push(existing._id);
            } else {
                // Create new metric
                const id = await ctx.db.insert("entity_metrics", {
                    tenantId: identity.tenantId,
                    siteId: args.siteId,
                    dataSourceId: args.dataSourceId,
                    metricType: metric.metricType,
                    metricKey: metric.metricKey,
                    value: metric.value,
                    metadata: metric.metadata,
                    updatedAt: now,
                });
                results.push(id);
            }
        }

        return results;
    },
});

/**
 * Upsert a metric value (internal, no auth required)
 * 
 * Same as upsertMetric but for internal/backend use with secret validation.
 * 
 * @example
 * await upsertMetric_s({
 *   secret: process.env.CONVEX_API_KEY,
 *   tenantId: "tenant_123",
 *   siteId: "site_123",
 *   metricType: "alert_severity",
 *   metricKey: "critical",
 *   value: 5
 * });
 */
export const upsertMetric_s = internalMutation({
    args: {
        secret: v.string(),
        tenantId: v.id("tenants"),
        siteId: v.optional(v.id("sites")),
        dataSourceId: v.optional(v.id("data_sources")),
        metricType: v.string(),
        metricKey: v.string(),
        value: v.number(),
        metadata: v.optional(v.any()),
    },
    handler: async (ctx: MutationCtx, args) => {
        await isValidSecret(args.secret);

        // Find existing metric
        const existing = await ctx.db
            .query("entity_metrics")
            .withIndex("by_site_type_key", (q) =>
                q
                    .eq("siteId", args.siteId)
                    .eq("metricType", args.metricType)
                    .eq("metricKey", args.metricKey)
                    .eq("tenantId", args.tenantId)
            )
            .first();

        const now = Date.now();

        if (existing) {
            // Update existing metric
            await ctx.db.patch(existing._id, {
                value: args.value,
                metadata: args.metadata,
                updatedAt: now,
            });
            return existing._id;
        } else {
            // Create new metric
            return await ctx.db.insert("entity_metrics", {
                tenantId: args.tenantId,
                siteId: args.siteId,
                dataSourceId: args.dataSourceId,
                metricType: args.metricType,
                metricKey: args.metricKey,
                value: args.value,
                metadata: args.metadata,
                updatedAt: now,
            });
        }
    },
});

/**
 * Increment/decrement a metric value (internal, no auth required)
 * 
 * Same as incrementMetric but for internal/backend use with secret validation.
 * 
 * @example
 * await incrementMetric_s({
 *   secret: process.env.CONVEX_API_KEY,
 *   tenantId: "tenant_123",
 *   siteId: "site_123",
 *   metricType: "alert_severity",
 *   metricKey: "critical",
 *   delta: 1
 * });
 */
export const incrementMetric_s = internalMutation({
    args: {
        secret: v.string(),
        tenantId: v.id("tenants"),
        siteId: v.optional(v.id("sites")),
        dataSourceId: v.optional(v.id("data_sources")),
        metricType: v.string(),
        metricKey: v.string(),
        delta: v.number(),
        metadata: v.optional(v.any()),
    },
    handler: async (ctx: MutationCtx, args) => {
        await isValidSecret(args.secret);

        // Find existing metric
        const existing = await ctx.db
            .query("entity_metrics")
            .withIndex("by_site_type_key", (q) =>
                q
                    .eq("siteId", args.siteId)
                    .eq("metricType", args.metricType)
                    .eq("metricKey", args.metricKey)
                    .eq("tenantId", args.tenantId)
            )
            .first();

        const now = Date.now();

        if (existing) {
            // Increment existing metric (ensure it doesn't go below 0)
            const newValue = Math.max(0, existing.value + args.delta);
            await ctx.db.patch(existing._id, {
                value: newValue,
                metadata: args.metadata ?? existing.metadata,
                updatedAt: now,
            });
            return existing._id;
        } else {
            // Create new metric with delta as initial value (ensure non-negative)
            const initialValue = Math.max(0, args.delta);
            return await ctx.db.insert("entity_metrics", {
                tenantId: args.tenantId,
                siteId: args.siteId,
                dataSourceId: args.dataSourceId,
                metricType: args.metricType,
                metricKey: args.metricKey,
                value: initialValue,
                metadata: args.metadata,
                updatedAt: now,
            });
        }
    },
});

/**
 * Batch upsert multiple metrics at once (internal, no auth required)
 * 
 * Same as batchUpsertMetrics but for internal/backend use with secret validation.
 * 
 * @example
 * await batchUpsertMetrics_s({
 *   secret: process.env.CONVEX_API_KEY,
 *   tenantId: "tenant_123",
 *   siteId: "site_123",
 *   metrics: [
 *     { metricType: "alert_severity", metricKey: "critical", value: 5 },
 *     { metricType: "alert_severity", metricKey: "high", value: 12 },
 *   ]
 * });
 */
export const batchUpsertMetrics_s = internalMutation({
    args: {
        secret: v.string(),
        tenantId: v.id("tenants"),
        siteId: v.optional(v.id("sites")),
        dataSourceId: v.optional(v.id("data_sources")),
        metrics: v.array(
            v.object({
                metricType: v.string(),
                metricKey: v.string(),
                value: v.number(),
                metadata: v.optional(v.any()),
            })
        ),
    },
    handler: async (ctx: MutationCtx, args) => {
        await isValidSecret(args.secret);
        const now = Date.now();

        const results = [];

        for (const metric of args.metrics) {
            // Find existing metric
            const existing = await ctx.db
                .query("entity_metrics")
                .withIndex("by_site_type_key", (q) =>
                    q
                        .eq("siteId", args.siteId)
                        .eq("metricType", metric.metricType)
                        .eq("metricKey", metric.metricKey)
                        .eq("tenantId", args.tenantId)
                )
                .first();

            if (existing) {
                // Update existing metric
                await ctx.db.patch(existing._id, {
                    value: metric.value,
                    metadata: metric.metadata,
                    updatedAt: now,
                });
                results.push(existing._id);
            } else {
                // Create new metric
                const id = await ctx.db.insert("entity_metrics", {
                    tenantId: args.tenantId,
                    siteId: args.siteId,
                    dataSourceId: args.dataSourceId,
                    metricType: metric.metricType,
                    metricKey: metric.metricKey,
                    value: metric.value,
                    metadata: metric.metadata,
                    updatedAt: now,
                });
                results.push(id);
            }
        }

        return results;
    },
});
