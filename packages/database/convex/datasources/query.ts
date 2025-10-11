import { v } from "convex/values";
import { query } from "../_generated/server.js";
import { isAuthenticated, isValidTenant } from "../helpers/validators.js";

export const getDataSource = query({
  args: {
    id: v.id("data_sources"),
  },
  handler: async (ctx, args) => {
    const identity = await isAuthenticated(ctx);
    const dataSource = await ctx.db.get(args.id);

    if (dataSource) {
      await isValidTenant(identity.tenantId, dataSource.tenantId);
      return dataSource;
    }
  },
});

export const getPrimaryByIntegration = query({
  args: {
    id: v.id("integrations"),
  },
  handler: async (ctx, args) => {
    const identity = await isAuthenticated(ctx);
    return await ctx.db
      .query("data_sources")
      .withIndex("by_integration_primary", (q) =>
        q
          .eq("integrationId", args.id)
          .eq("isPrimary", true)
          .eq("tenantId", identity.tenantId)
      )
      .unique();
  },
});
