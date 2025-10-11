import { v } from "convex/values";
import { action, internalQuery } from "../_generated/server.js";
import { isValidSecret } from "../helpers/validators.js";
import { internal } from "../_generated/api.js";
import { Doc } from "../_generated/dataModel.js";

export const _getPrimaryByIntegration = internalQuery({
  args: {
    integrationId: v.id("integrations"),
    tenantId: v.id("tenants"),
  },
  handler: async (ctx, { integrationId, tenantId }) => {
    return await ctx.db
      .query("data_sources")
      .withIndex("by_integration_primary", (q) =>
        q
          .eq("integrationId", integrationId)
          .eq("isPrimary", true)
          .eq("tenantId", tenantId)
      )
      .unique();
  },
});

export const getPrimaryByIntegration = action({
  args: {
    integrationId: v.id("integrations"),
    tenantId: v.id("tenants"),
    secret: v.string(),
  },
  handler: async (
    ctx,
    { secret, ...rest }
  ): Promise<Doc<"data_sources"> | null> => {
    await isValidSecret(secret);
    return await ctx.runQuery(
      internal.datasources.internal._getPrimaryByIntegration,
      rest
    );
  },
});
