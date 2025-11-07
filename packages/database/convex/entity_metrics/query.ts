import { v } from "convex/values";
import { query, QueryCtx } from "../_generated/server.js";
import { isAuthenticated, isValidSecret } from "../helpers/validators.js";
import type { Doc } from "../_generated/dataModel.js";

/**
 * Get all metrics for a site
 * 
 * @example
 * const metrics = await getMetricsBySite({
 *   siteId: "site_123"
 * });
 */
export const getMetricsBySite = query({
    args: {
        siteId: v.id("sites"),
    },
    handler: async (ctx: QueryCtx, args) => {
        const identity = await isAuthenticated(ctx);

        return await ctx.db
            .query("entity_metrics")
            .withIndex("by_site", (q) =>
                q.eq("siteId", args.siteId).eq("tenantId", identity.tenantId)
            )
            .collect();
    },
});

/**
 * Get metrics of a specific type for a site
 * 
 * @example
 * const alertMetrics = await getMetricsBySiteAndType({
 *   siteId: "site_123",
 *   metricType: "alert_severity"
 * });
 */
export const getMetricsBySiteAndType = query({
    args: {
        siteId: v.id("sites"),
        metricType: v.string(),
    },
    handler: async (ctx: QueryCtx, args) => {
        const identity = await isAuthenticated(ctx);

        return await ctx.db
            .query("entity_metrics")
            .withIndex("by_site_type", (q) =>
                q
                    .eq("siteId", args.siteId)
                    .eq("metricType", args.metricType)
                    .eq("tenantId", identity.tenantId)
            )
            .collect();
    },
});

/**
 * Get a specific metric value
 * 
 * @example
 * const criticalCount = await getMetric({
 *   siteId: "site_123",
 *   metricType: "alert_severity",
 *   metricKey: "critical"
 * });
 */
export const getMetric = query({
    args: {
        siteId: v.optional(v.id("sites")),
        metricType: v.string(),
        metricKey: v.string(),
    },
    handler: async (ctx: QueryCtx, args) => {
        const identity = await isAuthenticated(ctx);

        return await ctx.db
            .query("entity_metrics")
            .withIndex("by_site_type_key", (q) =>
                q
                    .eq("siteId", args.siteId)
                    .eq("metricType", args.metricType)
                    .eq("metricKey", args.metricKey)
                    .eq("tenantId", identity.tenantId)
            )
            .first();
    },
});

/**
 * Get all metrics for a data source
 * 
 * @example
 * const metrics = await getMetricsByDataSource({
 *   dataSourceId: "ds_123"
 * });
 */
export const getMetricsByDataSource = query({
    args: {
        dataSourceId: v.id("data_sources"),
    },
    handler: async (ctx: QueryCtx, args) => {
        const identity = await isAuthenticated(ctx);

        return await ctx.db
            .query("entity_metrics")
            .withIndex("by_data_source", (q) =>
                q.eq("dataSourceId", args.dataSourceId).eq("tenantId", identity.tenantId)
            )
            .collect();
    },
});

/**
 * Get all metrics for a tenant
 * 
 * @example
 * const metrics = await getMetricsByTenant();
 */
export const getMetricsByTenant = query({
    args: {},
    handler: async (ctx: QueryCtx) => {
        const identity = await isAuthenticated(ctx);

        return await ctx.db
            .query("entity_metrics")
            .withIndex("by_tenant", (q) => q.eq("tenantId", identity.tenantId))
            .collect();
    },
});

/**
 * Get metrics as a key-value map for easy access
 * 
 * @example
 * const alertCounts = await getMetricsMap({
 *   siteId: "site_123",
 *   metricType: "alert_severity"
 * });
 * // Returns: { critical: 5, high: 12, medium: 8, low: 3 }
 */
export const getMetricsMap = query({
    args: {
        siteId: v.optional(v.id("sites")),
        dataSourceId: v.optional(v.id("data_sources")),
        metricType: v.string(),
    },
    handler: async (ctx: QueryCtx, args) => {
        const identity = await isAuthenticated(ctx);

        let metrics: Doc<"entity_metrics">[];

        if (args.siteId) {
            metrics = await ctx.db
                .query("entity_metrics")
                .withIndex("by_site_type", (q) =>
                    q
                        .eq("siteId", args.siteId)
                        .eq("metricType", args.metricType)
                        .eq("tenantId", identity.tenantId)
                )
                .collect();
        } else if (args.dataSourceId) {
            metrics = await ctx.db
                .query("entity_metrics")
                .withIndex("by_data_source", (q) =>
                    q.eq("dataSourceId", args.dataSourceId).eq("tenantId", identity.tenantId)
                )
                .filter((q) => q.eq(q.field("metricType"), args.metricType))
                .collect();
        } else {
            metrics = await ctx.db
                .query("entity_metrics")
                .withIndex("by_type", (q) =>
                    q.eq("metricType", args.metricType).eq("tenantId", identity.tenantId)
                )
                .collect();
        }

        // Convert to key-value map
        return metrics.reduce((acc, metric) => {
            acc[metric.metricKey] = metric.value;
            return acc;
        }, {} as Record<string, number>);
    },
});

/**
 * Get all metrics for a site (internal, no auth required)
 * 
 * @example
 * const metrics = await getMetricsBySite_s({
 *   secret: process.env.CONVEX_API_KEY,
 *   tenantId: "tenant_123",
 *   siteId: "site_123"
 * });
 */
export const getMetricsBySite_s = query({
    args: {
        secret: v.string(),
        tenantId: v.id("tenants"),
        siteId: v.id("sites"),
    },
    handler: async (ctx: QueryCtx, args) => {
        await isValidSecret(args.secret);

        return await ctx.db
            .query("entity_metrics")
            .withIndex("by_site", (q) =>
                q.eq("siteId", args.siteId).eq("tenantId", args.tenantId)
            )
            .collect();
    },
});

/**
 * Get metrics of a specific type for a site (internal, no auth required)
 * 
 * @example
 * const alertMetrics = await getMetricsBySiteAndType_s({
 *   secret: process.env.CONVEX_API_KEY,
 *   tenantId: "tenant_123",
 *   siteId: "site_123",
 *   metricType: "alert_severity"
 * });
 */
export const getMetricsBySiteAndType_s = query({
    args: {
        secret: v.string(),
        tenantId: v.id("tenants"),
        siteId: v.id("sites"),
        metricType: v.string(),
    },
    handler: async (ctx: QueryCtx, args) => {
        await isValidSecret(args.secret);

        return await ctx.db
            .query("entity_metrics")
            .withIndex("by_site_type", (q) =>
                q
                    .eq("siteId", args.siteId)
                    .eq("metricType", args.metricType)
                    .eq("tenantId", args.tenantId)
            )
            .collect();
    },
});
