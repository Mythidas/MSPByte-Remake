import { v } from "convex/values";
import { query } from "../_generated/server.js";
import { isAuthenticated, isValidTenant } from "../helpers/validators.js";

// Replaced by sites/crud.ts::list
// export const getSites = ...

export const getSiteWithIntegrationsView = query({
  args: {
    id: v.id("sites"),
  },
  handler: async (ctx, args) => {
    const identity = await isAuthenticated(ctx);
    const site = await ctx.db.get(args.id);
    if (!site) throw new Error("Site not found");
    await isValidTenant(identity.tenantId, site.tenantId);

    // Query direct data sources and linked data sources in parallel
    const [directDataSources, dataSourceLinks] = await Promise.all([
      ctx.db
        .query("data_sources")
        .withIndex("by_site", (q) => q.eq("siteId", site._id))
        .collect(),
      ctx.db
        .query("data_source_to_site")
        .withIndex("by_site", (q) => q.eq("siteId", site._id))
        .collect(),
    ]);

    // Fetch linked data sources
    const linkedDataSources = await Promise.all(
      dataSourceLinks.map((link) => ctx.db.get(link.dataSourceId))
    );

    // Combine all data sources, filtering out nulls
    const allDataSources = [
      ...directDataSources,
      ...linkedDataSources.filter(
        (ds): ds is NonNullable<typeof ds> => ds !== null
      ),
    ];

    // Get unique integration IDs
    const uniqueIntegrationIds = [
      ...new Set(allDataSources.map((ds) => ds.integrationId)),
    ];

    // Fetch all integrations in parallel
    const integrations = await Promise.all(
      uniqueIntegrationIds.map((id) => ctx.db.get(id))
    );

    // Map to desired format, filtering out any null results
    const linkedIntegrations = integrations
      .filter(
        (integration): integration is NonNullable<typeof integration> =>
          integration !== null
      )
      .map((integration) => ({
        id: integration._id,
        slug: integration.slug,
        name: integration.name,
      }));

    return {
      ...site,
      psaIntegrationName: integrations.find(
        (i) => i?._id === site.psaIntegrationId
      )?.name,
      linkedIntegrations,
    };
  },
});
