import { v } from "convex/values";
import { useAuthQuery } from "./helper";
import type { IntegrationWithStatus } from "./types";
import { Doc } from "./_generated/dataModel";

/**
 * Integrations Queries and Mutations
 *
 * This module provides CRUD operations for integrations with authentication.
 */

// ============================================================================
// READ OPERATIONS (QUERIES)
// ============================================================================

/**
 * Get all integrations
 *
 * Replaces: ORM.getRows('integrations_view')
 */
export const getIntegrations = useAuthQuery({
  args: {},
  handler: async (ctx): Promise<Doc<"integrations">[]> => {
    return await ctx.db.query("integrations").collect();
  },
});

/**
 * Get all active integrations
 */
export const getActiveIntegrations = useAuthQuery({
  args: {},
  handler: async (ctx): Promise<Doc<"integrations">[]> => {
    return await ctx.db
      .query("integrations")
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();
  },
});

/**
 * Get integrations by category
 */
export const getIntegrationsByCategory = useAuthQuery({
  args: {
    category: v.string(),
  },
  handler: async (ctx, args): Promise<Doc<"integrations">[]> => {
    return await ctx.db
      .query("integrations")
      .withIndex("by_category", (q) => q.eq("category", args.category))
      .collect();
  },
});

/**
 * Get a single integration by ID
 *
 * Replaces: ORM.getRow('integrations_view', { filters: [['id', 'eq', id]] })
 */
export const getIntegrationById = useAuthQuery({
  args: {
    id: v.id("integrations"),
  },
  handler: async (ctx, args): Promise<Doc<"integrations"> | null> => {
    return await ctx.db.get(args.id);
  },
});

/**
 * Get enabled integrations for a tenant
 *
 * Replaces: ORM.getRow('enabled_integrations_view')
 */
export const getEnabledIntegrations = useAuthQuery({
  args: {},
  handler: async (ctx, args): Promise<IntegrationWithStatus[]> => {
    // Get all integrations
    const allIntegrations = await ctx.db.query("integrations").collect();

    // Get all data sources for this tenant
    const dataSources = await ctx.db
      .query("data_sources")
      // .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .collect();

    // Map integrations with their enabled status
    return allIntegrations.map((integration) => {
      const dataSource = dataSources.find(
        (ds) => ds.integrationId === integration._id
      );

      return {
        ...integration,
        isEnabled: !!dataSource,
        dataSourceStatus: dataSource?.status,
      };
    });
  },
});

/**
 * Get site-specific integrations
 *
 * Replaces: ORM.getRow('site_integrations_view', { filters: [['site_id', 'eq', siteId]] })
 */
export const getSiteIntegrations = useAuthQuery({
  args: {
    siteId: v.id("sites"),
  },
  handler: async (ctx, args): Promise<IntegrationWithStatus[]> => {
    // Get all integrations
    const allIntegrations = await ctx.db.query("integrations").collect();

    // Get all data sources for this site
    const dataSources = await ctx.db
      .query("data_sources")
      .withIndex("by_site", (q) => q.eq("siteId", args.siteId))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();

    // Map integrations with their enabled status for this site
    return allIntegrations.map((integration) => {
      const dataSource = dataSources.find(
        (ds) => ds.integrationId === integration._id
      );

      return {
        ...integration,
        isEnabled: !!dataSource,
        dataSourceStatus: dataSource?.status,
      };
    });
  },
});

// ============================================================================
// WRITE OPERATIONS (MUTATIONS) - TODO
// ============================================================================

/**
 * Create a new integration
 *
 * TODO: Implement this mutation
 */
/*
export const createIntegration = useAuthMutation({
  args: {
    id: v.id("integrations"), // Slug as ID
    name: v.string(),
    description: v.string(),
    category: v.string(),
    supportedTypes: v.array(v.string()),
    iconUrl: v.optional(v.string()),
    color: v.optional(v.string()),
    level: v.optional(v.string()),
    productUrl: v.optional(v.string()),
    configSchema: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const timestamp = Date.now();

    return await ctx.db.insert("integrations", {
      ...args,
      isActive: true,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  },
});
*/

/**
 * Update an integration
 *
 * TODO: Implement this mutation
 */
/*
export const updateIntegration = useAuthMutation({
  args: {
    id: v.id("integrations"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
    iconUrl: v.optional(v.string()),
    color: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;

    await ctx.db.patch(id, {
      ...updates,
      updatedAt: Date.now(),
    });
  },
});
*/
