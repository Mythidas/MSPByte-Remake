import { v } from "convex/values";
import { query } from "../_generated/server.js";
import { isAuthenticated, isValidTenant } from "../helpers/validators.js";

export const getBySiteAndIntegration = query({
    args: {
        siteId: v.id("sites"),
        integrationSlug: v.string(),
    },
    handler: async (ctx, args) => {
        const identity = await isAuthenticated(ctx);

        // Get integration by slug
        const integration = await ctx.db
            .query("integrations")
            .withIndex("by_slug", (q) => q.eq("slug", args.integrationSlug))
            .unique();

        if (!integration) {
            throw new Error("Integration not found");
        }

        // Get direct data source for this site + integration
        const directDataSource = await ctx.db
            .query("data_sources")
            .withIndex("by_site", (q) => q.eq("siteId", args.siteId).eq("tenantId", identity.tenantId))
            .filter((q) =>
                q.and(
                    q.eq(q.field("integrationId"), integration._id),
                )
            )
            .first();

        if (directDataSource) {
            await isValidTenant(identity.tenantId, directDataSource.tenantId);
            return directDataSource;
        }

        // Check for linked data sources
        const dataSourceLinks = await ctx.db
            .query("data_source_to_site")
            .withIndex("by_site", (q) => q.eq("siteId", args.siteId))
            .collect();

        for (const link of dataSourceLinks) {
            const linkedDataSource = await ctx.db.get(link.dataSourceId);
            if (linkedDataSource && linkedDataSource.integrationId === integration._id) {
                await isValidTenant(identity.tenantId, linkedDataSource.tenantId);
                return linkedDataSource;
            }
        }

        return null;
    },
});
