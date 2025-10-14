import { v } from "convex/values";
import { query } from "../_generated/server.js";
import { isAuthenticated } from "../helpers/validators.js";

export const getStatusMatrix = query({
  args: {
    dataSourceId: v.id("data_sources"),
    supportedTypes: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await isAuthenticated(ctx);

    // Fetch all jobs for this data source and integration
    const allJobs = await ctx.db
      .query("scheduled_jobs")
      .withIndex("by_data_source", (q) =>
        q
          .eq("dataSourceId", args.dataSourceId)
          .eq("tenantId", identity.tenantId)
      )
      .collect();

    // Sort jobs by _creationTime descending (most recent first)
    const sortedJobs = allJobs.sort(
      (a, b) => b._creationTime - a._creationTime
    );

    // Group jobs by entity type
    const jobsByType = new Map<string, typeof sortedJobs>();
    for (const type of args.supportedTypes) {
      const typeJobs = sortedJobs.filter(
        (job) => job.action === `sync.${type}`
      );
      jobsByType.set(type, typeJobs);
    }

    // Build sync status for each entity type
    const syncStatuses = args.supportedTypes.map((type) => {
      const jobs = jobsByType.get(type) || [];
      const mostRecentJob = jobs[0] || null;
      const failedCount = jobs.filter((j) => j.status === "failed").length;
      const runningCount = jobs.filter((j) => j.status === "running").length;
      const pendingCount = jobs.filter((j) => j.status === "pending").length;

      return {
        entityType: type,
        lastSync:
          mostRecentJob?.updatedAt || mostRecentJob?._creationTime || null,
        status: mostRecentJob?.status || "none",
        error: mostRecentJob?.error || null,
        totalJobs: jobs.length,
        failedJobs: failedCount,
        runningJobs: runningCount,
        pendingJobs: pendingCount,
      };
    });

    return syncStatuses;
  },
});

export const listActiveWithDataSource = query({
  args: {},
  handler: async (ctx, args) => {
    const identity = await isAuthenticated(ctx);
    const integrations = await ctx.db
      .query("integrations")
      .withIndex("by_is_active")
      .collect();

    return Promise.all(
      integrations.map(async (integration) => {
        const dataSources = await ctx.db
          .query("data_sources")
          .withIndex("by_primary", (q) =>
            q.eq("isPrimary", true).eq("tenantId", identity.tenantId)
          )
          .collect();
        const target = dataSources.find(
          (ds) => ds.integrationId === integration._id
        );

        return {
          ...integration,
          isEnabled: (target && !target.deletedAt) || false,
          dataSourceId: target?._id,
          dataSourceStatus: target?.status,
        };
      })
    );
  },
});

export const listActiveByCategory = query({
  args: {
    category: v.string(),
  },
  handler: async (ctx, args) => {
    await isAuthenticated(ctx);
    return await ctx.db
      .query("integrations")
      .withIndex("by_category", (q) => q.eq("category", args.category))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();
  },
});
