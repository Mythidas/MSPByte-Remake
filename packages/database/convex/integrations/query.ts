import { query } from "../_generated/server.js";
import { isAuthenticated } from "../helper.js";

export const getActiveIntegrationsView = query({
  args: {},
  handler: async (ctx, args) => {
    const identity = await isAuthenticated(ctx);

    const integrations = await ctx.db
      .query("integrations")
      .withIndex("by_is_active")
      .collect();

    return Promise.all(
      integrations.map(async (integration) => {
        const dataSource = await ctx.db
          .query("data_sources")
          .withIndex("by_integration_primary", (q) =>
            q.eq("integrationId", integration._id).eq("isPrimary", true)
          )
          .unique();

        return {
          ...integration,
          isEnabled: (dataSource && !dataSource.deletedAt) || false,
          dataSourceId: dataSource?._id,
          dataSourceStatus: dataSource?.status,
        };
      })
    );
  },
});
