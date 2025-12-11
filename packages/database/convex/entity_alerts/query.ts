import { v } from "convex/values";
import { query } from "../_generated/server.js";
import { isAuthenticated } from "../helpers/validators.js";

/**
 * Get alerts for multiple sites (used for group views)
 * Returns raw alerts with siteId - client should join with sites data
 */
export const getAlertsForSites = query({
  args: {
    siteIds: v.array(v.id("sites")),
  },
  handler: async (ctx, args) => {
    const identity = await isAuthenticated(ctx);

    // Get all alerts for the specified sites
    const allAlerts = [];

    for (const siteId of args.siteIds) {
      const alerts = await ctx.db
        .query("entity_alerts")
        .withIndex("by_site", (q) =>
          q.eq("siteId", siteId).eq("tenantId", identity.tenantId),
        )
        .collect();

      allAlerts.push(...alerts);
    }

    return allAlerts;
  },
});
