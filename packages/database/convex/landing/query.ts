import { query } from "../_generated/server.js";
import { isAuthenticated } from "../helpers/validators.js";

/**
 * Get aggregate metrics for the landing page dashboard
 *
 * Returns counts and summary data for sites, integrations, alerts, and agents
 * for the authenticated user's tenant.
 */
export const getLandingMetrics = query({
  args: {},
  handler: async (ctx) => {
    const identity = await isAuthenticated(ctx);

    // Get all sites count
    const sites = await ctx.db
      .query("sites")
      .withIndex("by_tenant", (q) => q.eq("tenantId", identity.tenantId))
      .collect();

    const totalSites = sites.length;
    const activeSites = sites.filter((site) => site.status === "active").length;

    // Get data sources (integrations) count
    const dataSources = await ctx.db
      .query("data_sources")
      .withIndex("by_tenant", (q) => q.eq("tenantId", identity.tenantId))
      .collect();

    const totalIntegrations = dataSources.length;
    const activeIntegrations = dataSources.filter(
      (ds) => ds.status === "active",
    ).length;

    // Get agents count and status breakdown
    const agents = await ctx.db
      .query("agents")
      .withIndex("by_tenant", (q) => q.eq("tenantId", identity.tenantId))
      .collect();

    const totalAgents = agents.length;
    const onlineAgents = agents.filter(
      (agent) => agent.status === "online",
    ).length;
    const offlineAgents = agents.filter(
      (agent) => agent.status === "offline",
    ).length;
    const unknownAgents = agents.filter(
      (agent) => agent.status === "unknown" || !agent.status,
    ).length;

    // Get alert counts by severity
    const alerts = await ctx.db
      .query("entity_alerts")
      .withIndex("by_tenant", (q) => q.eq("tenantId", identity.tenantId))
      .collect();

    const alertCounts = {
      critical: alerts.filter(
        (alert) => alert.severity === "critical" && alert.status === "active",
      ).length,
      high: alerts.filter(
        (alert) => alert.severity === "high" && alert.status === "active",
      ).length,
      medium: alerts.filter(
        (alert) => alert.severity === "medium" && alert.status === "active",
      ).length,
      low: alerts.filter(
        (alert) => alert.severity === "low" && alert.status === "active",
      ).length,
    };

    const totalAlerts =
      alertCounts.critical +
      alertCounts.high +
      alertCounts.medium +
      alertCounts.low;

    // Get entity counts (total entities across all types)
    const entities = await ctx.db
      .query("entities")
      .withIndex("by_tenant", (q) => q.eq("tenantId", identity.tenantId))
      .collect();

    const totalEntities = entities.length;

    return {
      sites: {
        total: totalSites,
        active: activeSites,
      },
      integrations: {
        total: totalIntegrations,
        active: activeIntegrations,
      },
      agents: {
        total: totalAgents,
        online: onlineAgents,
        offline: offlineAgents,
        unknown: unknownAgents,
      },
      alerts: {
        total: totalAlerts,
        ...alertCounts,
      },
      entities: {
        total: totalEntities,
      },
    };
  },
});
