import { v } from "convex/values";
import { mutation } from "../_generated/server.js";
import { isAuthenticated, isValidTenant } from "../helpers/validators.js";
import { genSUUID } from "@workspace/shared/lib/utils";

export const linkToPSACompany = mutation({
    args: {
        siteId: v.id("sites"),
        integrationId: v.id("integrations"),
        companyExternalId: v.string(),
        companyExternalParentId: v.optional(v.string()),
        integrationName: v.string(),
    },
    handler: async (ctx, args) => {
        const identity = await isAuthenticated(ctx);

        // Verify site exists and user has access
        const site = await ctx.db.get(args.siteId);
        if (!site) {
            throw new Error("Site not found");
        }
        await isValidTenant(identity.tenantId, site.tenantId);

        // Update site with PSA fields
        await ctx.db.patch(args.siteId, {
            psaCompanyId: args.companyExternalId,
            psaIntegrationId: args.integrationId,
            psaParentCompanyId: args.companyExternalParentId,
            psaIntegrationName: args.integrationName,
            updatedAt: Date.now(),
        });

        return await ctx.db.get(args.siteId);
    },
});

export const unlinkFromPSACompany = mutation({
    args: {
        siteId: v.id("sites"),
    },
    handler: async (ctx, args) => {
        const identity = await isAuthenticated(ctx);

        // Verify site exists and user has access
        const site = await ctx.db.get(args.siteId);
        if (!site) {
            throw new Error("Site not found");
        }
        await isValidTenant(identity.tenantId, site.tenantId);

        // Clear PSA fields
        await ctx.db.patch(args.siteId, {
            psaCompanyId: undefined,
            psaIntegrationId: undefined,
            psaParentCompanyId: undefined,
            psaIntegrationName: undefined,
            updatedAt: Date.now(),
        });

        return await ctx.db.get(args.siteId);
    },
});

export const createFromPSACompany = mutation({
    args: {
        name: v.string(),
        integrationId: v.id("integrations"),
        companyExternalId: v.string(),
        companyExternalParentId: v.optional(v.string()),
        integrationName: v.string(),
    },
    handler: async (ctx, args) => {
        const identity = await isAuthenticated(ctx);

        // Generate 8-character SUUID slug
        let slug = genSUUID(8);

        // Check if slug already exists (very unlikely with random generation)
        let existingWithSlug = await ctx.db
            .query("sites")
            .withIndex("by_slug", (q) => q.eq("slug", slug))
            .first();

        // Regenerate if collision occurs (extremely rare)
        while (existingWithSlug) {
            slug = genSUUID(8);
            existingWithSlug = await ctx.db
                .query("sites")
                .withIndex("by_slug", (q) => q.eq("slug", slug))
                .first();
        }

        const finalSlug = slug;

        // Create new site with PSA fields
        const siteId = await ctx.db.insert("sites", {
            tenantId: identity.tenantId,
            name: args.name,
            slug: finalSlug,
            status: 'active',
            psaCompanyId: args.companyExternalId,
            psaIntegrationId: args.integrationId,
            psaParentCompanyId: args.companyExternalParentId,
            psaIntegrationName: args.integrationName,
            updatedAt: Date.now(),
        });

        return await ctx.db.get(siteId);
    },
});
