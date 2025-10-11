import { v } from "convex/values";
import { query } from "../_generated/server.js";
import { isAuthenticated } from "../helpers/validators.js";

export const getCompaniesWithSite = query({
  args: {
    integrationId: v.id("integrations"),
  },
  handler: async (ctx, args) => {
    const identity = await isAuthenticated(ctx);
    const entities = await ctx.db
      .query("entities")
      .withIndex("by_integration", (q) =>
        q
          .eq("integrationId", args.integrationId)
          .eq("tenantId", identity.tenantId)
      )
      .collect();

    return Promise.all(
      entities.map(async (e) => {
        const site = await ctx.db
          .query("sites")
          .withIndex("by_psa_id", (q) => q.eq("psaCompanyId", e.externalId))
          .unique();

        return {
          ...e,
          name: e.normalizedData.name,
          externalParentId: e.normalizedData.externalParentId,
          isLinked: !!site,
          linkedId: site?._id,
          linkedSlug: site?.slug,
          linkedName: site?.name,
        };
      })
    );
  },
});
