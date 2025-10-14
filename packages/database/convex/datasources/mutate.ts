import { v } from "convex/values";
import { mutation } from "../_generated/server.js";
import { isAuthenticated, isValidTenant } from "../helpers/validators.js";

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
