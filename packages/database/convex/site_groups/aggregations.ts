import { v } from "convex/values";
import { query } from "../_generated/server.js";
import { isAuthenticated } from "../helpers/validators.js";
import { Id } from "../_generated/dataModel.js";

/**
 * Get list of integrations active in a group
 * Returns integration details with entity counts
 */
export const getGroupIntegrations = query({
    args: {
        groupId: v.id("site_groups"),
    },
    handler: async (ctx, args) => {
        const identity = await isAuthenticated(ctx);

        // Verify group exists
        const group = await ctx.db.get(args.groupId);
        if (!group || group.tenantId !== identity.tenantId || group.deletedAt) {
            throw new Error("Site group not found");
        }

        // Get all site IDs in the group
        const memberships = await ctx.db
            .query("site_group_members")
            .withIndex("by_group", (q) =>
                q.eq("siteGroupId", args.groupId).eq("tenantId", identity.tenantId)
            )
            .collect();

        const siteIds = memberships.map((m) => m.siteId);

        if (siteIds.length === 0) {
            return [];
        }

        // Collect unique integrations from data sources
        const integrationDataMap = new Map<string, { entityCount: number, siteCount: number }>();

        for (const siteId of siteIds) {
            // Get data sources for this site
            const dataSources = await ctx.db
                .query("data_sources")
                .withIndex("by_site", (q) => q.eq("siteId", siteId))
                .collect();

            for (const ds of dataSources) {
                if (!integrationDataMap.has(ds.integrationId)) {
                    integrationDataMap.set(ds.integrationId, { entityCount: 0, siteCount: 0 });
                }
                integrationDataMap.get(ds.integrationId)!.siteCount++;

                // Count entities for this data source
                const entities = await ctx.db
                    .query("entities")
                    .withIndex("by_data_source", (q) => q.eq("dataSourceId", ds._id))
                    .filter((q) => q.eq(q.field("deletedAt"), undefined))
                    .collect();

                integrationDataMap.get(ds.integrationId)!.entityCount += entities.length;
            }
        }

        // Fetch integration details and combine with counts
        const integrations = await Promise.all(
            Array.from(integrationDataMap.entries()).map(async ([integrationId, data]) => {
                const integration = await ctx.db.get(integrationId as Id<'integrations'>);
                if (!integration) return null;

                return {
                    _id: integration._id,
                    name: integration.name,
                    slug: integration.slug,
                    entityCount: data.entityCount,
                    siteCount: data.siteCount
                };
            })
        );

        return integrations.filter((i) => i !== null).sort((a, b) => a.name.localeCompare(b.name));
    },
});

/**
 * Get aggregated metrics for a group
 * Returns counts for active alerts, integrations, and entities
 */
export const getGroupMetrics = query({
    args: {
        groupId: v.id("site_groups"),
    },
    handler: async (ctx, args) => {
        const identity = await isAuthenticated(ctx);

        // Verify group exists
        const group = await ctx.db.get(args.groupId);
        if (!group || group.tenantId !== identity.tenantId || group.deletedAt) {
            throw new Error("Site group not found");
        }

        // Get all site IDs in the group
        const memberships = await ctx.db
            .query("site_group_members")
            .withIndex("by_group", (q) =>
                q.eq("siteGroupId", args.groupId).eq("tenantId", identity.tenantId)
            )
            .collect();

        const siteIds = memberships.map((m) => m.siteId);

        if (siteIds.length === 0) {
            return {
                activeAlerts: 0,
                alertsBySeverity: { critical: 0, high: 0, medium: 0, low: 0 },
                integrationsCount: 0,
                totalEntities: 0,
                entitiesByType: {},
            };
        }

        // Count active alerts and group by severity
        let activeAlerts = 0;
        const alertsBySeverity = { critical: 0, high: 0, medium: 0, low: 0 };
        const integrationIds = new Set<string>();
        let totalEntities = 0;
        const entitiesByType: Record<string, number> = {};

        // Process each site
        for (const siteId of siteIds) {
            // Query active alerts for this site
            const alerts = await ctx.db
                .query("entity_alerts")
                .withIndex("by_site_status", (q) =>
                    q.eq("siteId", siteId).eq("status", "active")
                )
                .collect();

            activeAlerts += alerts.length;

            // Count by severity
            for (const alert of alerts) {
                alertsBySeverity[alert.severity as keyof typeof alertsBySeverity]++;
            }

            // Get data sources for this site to count unique integrations
            const dataSources = await ctx.db
                .query("data_sources")
                .withIndex("by_site", (q) => q.eq("siteId", siteId))
                .collect();

            for (const ds of dataSources) {
                integrationIds.add(ds.integrationId);
            }

            // Count entities by type
            const entities = await ctx.db
                .query("entities")
                .withIndex("by_site", (q) => q.eq("siteId", siteId))
                .filter((q) => q.eq(q.field("deletedAt"), undefined))
                .collect();

            totalEntities += entities.length;

            for (const entity of entities) {
                entitiesByType[entity.entityType] = (entitiesByType[entity.entityType] || 0) + 1;
            }
        }

        return {
            activeAlerts,
            alertsBySeverity,
            integrationsCount: integrationIds.size,
            totalEntities,
            entitiesByType,
        };
    },
});

/**
 * Get entities for a group organized by integration
 * Returns a structure suitable for displaying entities by integration tabs
 */
export const getGroupEntitiesByIntegration = query({
    args: {
        groupId: v.id("site_groups"),
    },
    handler: async (ctx, args) => {
        const identity = await isAuthenticated(ctx);

        // Verify group exists
        const group = await ctx.db.get(args.groupId);
        if (!group || group.tenantId !== identity.tenantId || group.deletedAt) {
            throw new Error("Site group not found");
        }

        // Get all site IDs in the group
        const memberships = await ctx.db
            .query("site_group_members")
            .withIndex("by_group", (q) =>
                q.eq("siteGroupId", args.groupId).eq("tenantId", identity.tenantId)
            )
            .collect();

        const siteIds = memberships.map((m) => m.siteId);

        if (siteIds.length === 0) {
            return [];
        }

        // Get all entities for all sites in the group
        const allEntities: any[] = [];
        const siteMap = new Map();

        for (const siteId of siteIds) {
            // Get site info
            const site = await ctx.db.get(siteId);
            if (site && !site.deletedAt) {
                siteMap.set(siteId, { name: site.name, slug: site.slug });
            }

            // Get entities for this site
            const entities = await ctx.db
                .query("entities")
                .withIndex("by_site", (q) => q.eq("siteId", siteId))
                .filter((q) => q.eq(q.field("deletedAt"), undefined))
                .collect();

            // Enrich entities with site info
            for (const entity of entities) {
                const integration = await ctx.db.get(entity.integrationId);
                allEntities.push({
                    ...entity,
                    siteName: site?.name,
                    siteSlug: site?.slug,
                    integrationName: integration?.name,
                    integrationSlug: integration?.slug,
                });
            }
        }

        // Group by integration
        const byIntegration = allEntities.reduce((acc, entity) => {
            const integrationKey = entity.integrationId;
            if (!acc[integrationKey]) {
                acc[integrationKey] = {
                    integrationId: entity.integrationId,
                    integrationName: entity.integrationName,
                    integrationSlug: entity.integrationSlug,
                    entities: [],
                };
            }
            acc[integrationKey].entities.push(entity);
            return acc;
        }, {} as Record<string, any>);

        return Object.values(byIntegration);
    },
});

/**
 * Get entities across multiple sites (for global integrations view)
 * Accepts array of site IDs directly - client determines which sites to query
 */
export const getEntitiesForSites = query({
    args: {
        siteIds: v.array(v.id("sites")),
        entityType: v.optional(v.string()),
        integrationId: v.optional(v.id("integrations")),
    },
    handler: async (ctx, args) => {
        const identity = await isAuthenticated(ctx);

        if (args.siteIds.length === 0) {
            return [];
        }

        // Get all entities for all sites
        const allEntities: any[] = [];

        for (const siteId of args.siteIds) {
            // Get site info
            const site = await ctx.db.get(siteId);
            if (!site || site.deletedAt) continue;

            // Query entities with optional type filter
            let query = ctx.db
                .query("entities")
                .withIndex("by_site", (q) => q.eq("siteId", siteId))
                .filter((q) => q.eq(q.field("deletedAt"), undefined));

            const entities = await query.collect();

            // Apply client-side filters for type and integration
            const filteredEntities = entities.filter((e) => {
                if (args.entityType && e.entityType !== args.entityType) return false;
                if (args.integrationId && e.integrationId !== args.integrationId) return false;
                return true;
            });

            // Enrich with site and integration info
            for (const entity of filteredEntities) {
                const integration = await ctx.db.get(entity.integrationId);
                allEntities.push({
                    ...entity,
                    siteName: site.name,
                    siteSlug: site.slug,
                    siteId: site._id,
                    integrationName: integration?.name,
                    integrationSlug: integration?.slug,
                });
            }
        }

        // Sort by updatedAt descending
        allEntities.sort((a, b) => b.updatedAt - a.updatedAt);

        return allEntities;
    },
});
