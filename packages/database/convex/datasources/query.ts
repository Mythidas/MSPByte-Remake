import { v } from "convex/values";
import { query } from "../_generated/server.js";
import { isAuthenticated, isValidTenant } from "../helpers/validators.js";
import { integrationValidator } from "../schema.js";

export const getBySiteAndIntegration = query({
    args: {
        siteId: v.id("sites"),
        integrationId: integrationValidator,
    },
    handler: async (ctx, args) => {
        const identity = await isAuthenticated(ctx);

        // Get direct data source for this site + integration
        const directDataSource = await ctx.db
            .query("data_sources")
            .withIndex("by_site", (q) => q.eq("siteId", args.siteId).eq("tenantId", identity.tenantId))
            .filter((q) =>
                q.and(
                    q.eq(q.field("integrationId"), args.integrationId),
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
            if (linkedDataSource && linkedDataSource.integrationId === args.integrationId) {
                await isValidTenant(identity.tenantId, linkedDataSource.tenantId);
                return linkedDataSource;
            }
        }

        return null;
    },
});
