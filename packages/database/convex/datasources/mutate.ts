import { v } from "convex/values";
import { mutation } from "../_generated/server.js";
import { isAuthenticated, isValidTenant } from "../helpers/validators.js";
import { api } from "../_generated/api.js";

// Replaced by datasources/crud.ts::update
// export const updateConfig = ...

// Note: Kept for backward compatibility - used in actions.ts
export const disable = mutation({
    args: {
        id: v.id("data_sources"),
    },
    handler: async (ctx, args) => {
        const identity = await isAuthenticated(ctx);
        const dataSource = await ctx.db.get(args.id);
        if (!dataSource) throw new Error("Resource not found");
        await isValidTenant(identity.tenantId, dataSource.tenantId);

        await ctx.db.patch(args.id, {
            status: "inactive",
            deletedAt: new Date().getTime(),
        });

        return true;
    },
});

export const enable = mutation({
    args: {
        id: v.id("data_sources"),
    },
    handler: async (ctx, args) => {
        const identity = await isAuthenticated(ctx);
        const dataSource = await ctx.db.get(args.id);
        if (!dataSource) throw new Error("Resource not found");
        await isValidTenant(identity.tenantId, dataSource.tenantId);

        await ctx.db.patch(args.id, {
            status: "active",
            deletedAt: undefined,
        });

        return true;
    },
});

export const createPrimaryForIntegration = mutation({
    args: {
        integrationId: v.id("integrations"),
    },
    handler: async (ctx, args) => {
        const identity = await isAuthenticated(ctx);
        const integration = await ctx.db.get(args.integrationId);
        if (!integration) throw new Error("Resource not found");

        const newDataSource = await ctx.db.insert("data_sources", {
            tenantId: identity.tenantId,
            integrationId: args.integrationId,
            status: "active",
            config: {},
            credentialExpirationAt: Number.MAX_SAFE_INTEGER,
            isPrimary: true,
            updatedAt: new Date().getTime(),
        });

        return await ctx.db.get(newDataSource);
    },
});

export const createOrUpdate = mutation({
    args: {
        integrationId: v.id("integrations"),
        config: v.any(),
        credentialExpirationAt: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const identity = await isAuthenticated(ctx);
        const integration = await ctx.db.get(args.integrationId);
        if (!integration) throw new Error("Integration not found");

        // Check if a primary data source already exists for this integration and tenant
        const existingDataSource = await ctx.db
            .query("data_sources")
            .withIndex("by_integration_primary", (q) =>
                q.eq("integrationId", args.integrationId).eq("isPrimary", true)
            )
            .filter((q) => q.eq(q.field("tenantId"), identity.tenantId))
            .first();

        let dataSourceId;

        if (existingDataSource) {
            // Update existing data source
            await ctx.db.patch(existingDataSource._id, {
                config: args.config,
                credentialExpirationAt: args.credentialExpirationAt ?? existingDataSource.credentialExpirationAt,
                status: "active",
                updatedAt: new Date().getTime(),
            });
            dataSourceId = existingDataSource._id;
        } else {
            // Create new primary data source
            dataSourceId = await ctx.db.insert("data_sources", {
                tenantId: identity.tenantId,
                integrationId: args.integrationId,
                status: "active",
                config: args.config,
                credentialExpirationAt: args.credentialExpirationAt ?? Number.MAX_SAFE_INTEGER,
                isPrimary: true,
                updatedAt: new Date().getTime(),
            });
        }

        // Automatically schedule sync jobs for all supportedTypes
        await ctx.runMutation(api.scheduledjobs.mutate.scheduleJobsByIntegration, {
            integrationId: args.integrationId,
            dataSourceId: dataSourceId,
        });

        return await ctx.db.get(dataSourceId);
    },
});

export const createSiteMapping = mutation({
    args: {
        siteId: v.id("sites"),
        integrationId: v.id("integrations"),
        externalId: v.string(),
        config: v.any(),
    },
    handler: async (ctx, args) => {
        const identity = await isAuthenticated(ctx);
        const site = await ctx.db.get(args.siteId);
        if (!site) throw new Error("Site not found");
        await isValidTenant(identity.tenantId, site.tenantId);

        const integration = await ctx.db.get(args.integrationId);
        if (!integration) throw new Error("Integration not found");

        // Check if a mapping already exists for this site + integration
        const existingMapping = await ctx.db
            .query("data_sources")
            .withIndex("by_site", (q) => q.eq("siteId", args.siteId))
            .filter((q) => q.eq(q.field("integrationId"), args.integrationId))
            .first();

        if (existingMapping) {
            // Update existing mapping
            await ctx.db.patch(existingMapping._id, {
                externalId: args.externalId,
                config: args.config,
                updatedAt: new Date().getTime(),
            });
            return await ctx.db.get(existingMapping._id);
        } else {
            // Create new mapping
            const newDataSource = await ctx.db.insert("data_sources", {
                tenantId: identity.tenantId,
                integrationId: args.integrationId,
                siteId: args.siteId,
                externalId: args.externalId,
                status: "active",
                config: args.config,
                credentialExpirationAt: Number.MAX_SAFE_INTEGER,
                isPrimary: false,
                updatedAt: new Date().getTime(),
            });

            return await ctx.db.get(newDataSource);
        }
    },
});

// Replaced by datasources/crud.ts::deleteDataSource with hard: true
// Note: This function had find logic - you may want to keep it as a wrapper
export const deleteSiteMapping = mutation({
    args: {
        siteId: v.id("sites"),
        integrationId: v.id("integrations"),
    },
    handler: async (ctx, args) => {
        const identity = await isAuthenticated(ctx);
        const site = await ctx.db.get(args.siteId);
        if (!site) throw new Error("Site not found");
        await isValidTenant(identity.tenantId, site.tenantId);

        // Find the data source for this site + integration
        const dataSource = await ctx.db
            .query("data_sources")
            .withIndex("by_site", (q) => q.eq("siteId", args.siteId))
            .filter((q) => q.eq(q.field("integrationId"), args.integrationId))
            .first();

        if (!dataSource) {
            throw new Error("Mapping not found");
        }

        await ctx.db.delete(dataSource._id);
        return true;
    },
});

export const updateM365DomainMappings = mutation({
    args: {
        dataSourceId: v.id("data_sources"),
        domainMappings: v.array(
            v.object({
                domain: v.string(),
                siteId: v.string(),
            })
        ),
    },
    handler: async (ctx, args) => {
        const identity = await isAuthenticated(ctx);
        const dataSource = await ctx.db.get(args.dataSourceId);
        if (!dataSource) throw new Error("Data source not found");
        await isValidTenant(identity.tenantId, dataSource.tenantId);

        // Validate: each domain maps to only one site
        const domainSet = new Set<string>();
        const siteSet = new Set<string>();
        for (const mapping of args.domainMappings) {
            if (domainSet.has(mapping.domain)) {
                throw new Error(`Domain ${mapping.domain} is mapped multiple times`);
            }
            domainSet.add(mapping.domain);
            siteSet.add(mapping.siteId);
        }

        // Validate: each site is mapped to only one M365 connection
        // Check if any of these sites are linked to OTHER M365 data sources
        const otherM365Links = await ctx.db
            .query("data_source_to_site")
            .withIndex("by_tenant", (q) => q.eq("tenantId", identity.tenantId))
            .collect();

        for (const link of otherM365Links) {
            // Skip links that belong to this data source
            if (link.dataSourceId === args.dataSourceId) continue;

            // Check if this link's site is in our new mappings
            if (siteSet.has(link.siteId)) {
                const site = await ctx.db.get(link.siteId as any) as any;
                throw new Error(
                    `Site "${site?.name}" is already linked to another M365 connection`
                );
            }
        }

        // Update the data_source config with new domainMappings
        const updatedConfig = {
            ...(dataSource.config as any),
            domainMappings: args.domainMappings,
        };

        await ctx.db.patch(args.dataSourceId, {
            config: updatedConfig,
            updatedAt: new Date().getTime(),
        });

        // Sync data_source_to_site table
        // 1. Remove old links for this data source
        const existingLinks = await ctx.db
            .query("data_source_to_site")
            .withIndex("by_data_source", (q) =>
                q.eq("dataSourceId", args.dataSourceId)
            )
            .collect();

        for (const link of existingLinks) {
            await ctx.db.delete(link._id);
        }

        // 2. Create new links for each unique site
        const uniqueSites = [...siteSet];
        for (const siteId of uniqueSites) {
            await ctx.db.insert("data_source_to_site", {
                tenantId: identity.tenantId,
                integrationId: dataSource.integrationId,
                dataSourceId: args.dataSourceId,
                siteId: siteId as any,
            });
        }

        return true;
    },
});
