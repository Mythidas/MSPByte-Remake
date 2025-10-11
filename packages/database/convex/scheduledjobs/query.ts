import { v } from "convex/values";
import { query } from "../_generated/server.js";
import { isAuthenticated } from "../helpers/validators.js";

export const getFailedCountByDataSource = query({
  args: {
    dataSourceId: v.id("data_sources"),
  },
  handler: async (ctx, args) => {
    const identity = await isAuthenticated(ctx);

    const jobs = await ctx.db
      .query("scheduled_jobs")
      .withIndex("by_data_source_status", (q) =>
        q
          .eq("dataSourceId", args.dataSourceId)
          .eq("status", "failed")
          .eq("tenantId", identity.tenantId)
      )
      .collect();

    return jobs.length;
  },
});

// Replaced by scheduledjobs/crud.ts::get with filters
// Note: Original used .unique(), CRUD uses .first() - similar but slightly different behavior
// export const getRecentByDataSource = ...
