import { v } from "convex/values";
import { query } from "../_generated/server.js";
import { isAuthenticated } from "../helpers/validators.js";

export const getIntegration = query({
  args: {
    id: v.id("integrations"),
  },
  handler: async (ctx, args) => {
    await isAuthenticated(ctx);
    return await ctx.db.get(args.id);
  },
});

export const getIntegrationBySlug = query({
  args: {
    slug: v.string(),
  },
  handler: async (ctx, args) => {
    await isAuthenticated(ctx);
    return await ctx.db
      .query("integrations")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
  },
});

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
            q
              .eq("integrationId", integration._id)
              .eq("isPrimary", true)
              .eq("tenantId", identity.tenantId)
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

    // Sort jobs by createdAt descending (most recent first)
    const sortedJobs = allJobs.sort((a, b) => b.createdAt - a.createdAt);

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
        lastSync: mostRecentJob?.updatedAt || mostRecentJob?.createdAt || null,
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
