import { v } from "convex/values";
import { query, mutation } from "../_generated/server.js";
import { isAuthenticated, isValidTenant } from "../helpers/validators.js";
import type { OrderedQuery, Query } from "convex/server";
import type { DataModel, Id } from "../_generated/dataModel.js";
import { paginationOptsValidator } from "convex/server";

// ============================================================================
// TYPES
// ============================================================================

const statusValidator = v.union(
  v.literal("active"),
  v.literal("inactive"),
  v.literal("error")
);

// ============================================================================
// SHARED HELPER
// ============================================================================

/**
 * Builds a progressive query for data_sources based on provided filters.
 * Selects the most efficient index based on which filters are provided.
 */
function buildProgressiveQuery(
  ctx: any,
  tenantId: Id<"tenants">,
  filters: {
    integrationId?: Id<"integrations">;
    isPrimary?: boolean;
    siteId?: Id<"sites">;
    status?: "active" | "inactive" | "error";
  }
): Query<DataModel["data_sources"]> {
  const { integrationId, isPrimary, siteId, status } = filters;

  // Progressive index selection - choose most specific index with time ordering
  if (integrationId && isPrimary !== undefined) {
    return ctx.db
      .query("data_sources")
      .withIndex("by_integration_primary", (q: any) =>
        q
          .eq("integrationId", integrationId)
          .eq("isPrimary", isPrimary)
          .eq("tenantId", tenantId)
      );
  } else if (integrationId) {
    return ctx.db
      .query("data_sources")
      .withIndex("by_integration_ordered", (q: any) =>
        q.eq("integrationId", integrationId).eq("tenantId", tenantId)
      );
  } else if (siteId) {
    return ctx.db
      .query("data_sources")
      .withIndex("by_site_ordered", (q: any) =>
        q.eq("siteId", siteId).eq("tenantId", tenantId)
      );
  } else if (status) {
    return ctx.db
      .query("data_sources")
      .withIndex("by_status", (q: any) =>
        q.eq("status", status).eq("tenantId", tenantId)
      );
  } else {
    // Fallback - use status index with a filter
    return ctx.db
      .query("data_sources")
      .withIndex("by_status", (q: any) =>
        q.eq("status", "active").eq("tenantId", tenantId)
      )
      .filter((q: any) =>
        q.or(
          q.eq(q.field("status"), "active"),
          q.eq(q.field("status"), "inactive"),
          q.eq(q.field("status"), "error")
        )
      );
  }
}

// ============================================================================
// CRUD OPERATIONS
// ============================================================================

/**
 * List data sources with optional filtering, ordering, and pagination.
 *
 * @example
 * // Get all data sources for an integration
 * await ctx.runQuery(api.datasources.crud.list, { integrationId: "..." })
 *
 * @example
 * // Get paginated primary data sources, newest first
 * await ctx.runQuery(api.datasources.crud.list, {
 *   isPrimary: true,
 *   order: "desc",
 *   paginationOpts: { numItems: 50, cursor: null }
 * })
 */
export const list = query({
  args: {
    integrationId: v.optional(v.id("integrations")),
    isPrimary: v.optional(v.boolean()),
    siteId: v.optional(v.id("sites")),
    status: v.optional(statusValidator),
    order: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
    paginationOpts: v.optional(paginationOptsValidator),
  },
  handler: async (ctx, args) => {
    const identity = await isAuthenticated(ctx);
    const { order = "desc", paginationOpts, ...filters } = args;

    // Build progressive query
    let indexedQuery = buildProgressiveQuery(ctx, identity.tenantId, filters);

    // Apply ordering
    let query: OrderedQuery<DataModel["data_sources"]> = indexedQuery;
    query = indexedQuery.order(order);

    // Return paginated or full results
    if (paginationOpts) {
      return await query.paginate(paginationOpts);
    } else {
      return await query.collect();
    }
  },
});

/**
 * Get a single data source - supports both direct ID lookup and filter-based queries.
 *
 * @example
 * // Get by ID
 * await ctx.runQuery(api.datasources.crud.get, { id: "..." })
 *
 * @example
 * // Get primary data source for an integration
 * await ctx.runQuery(api.datasources.crud.get, {
 *   integrationId: "...",
 *   isPrimary: true
 * })
 */
export const get = query({
  args: {
    id: v.optional(v.id("data_sources")),
    integrationId: v.optional(v.id("integrations")),
    isPrimary: v.optional(v.boolean()),
    siteId: v.optional(v.id("sites")),
    status: v.optional(statusValidator),
    externalId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await isAuthenticated(ctx);

    // Direct ID lookup mode
    if (args.id) {
      const dataSource = await ctx.db.get(args.id);
      if (dataSource) {
        await isValidTenant(identity.tenantId, dataSource.tenantId);
      }
      return dataSource;
    }

    // Filter-based mode - special case for externalId lookup
    if (args.externalId) {
      return await ctx.db
        .query("data_sources")
        .withIndex("by_external_id", (q) =>
          q.eq("externalId", args.externalId!).eq("tenantId", identity.tenantId)
        )
        .first();
    }

    // Filter-based mode - use progressive query builder
    const { id, externalId, ...filters } = args;
    const query = buildProgressiveQuery(ctx, identity.tenantId, filters);

    // Always get newest record when using filters
    return await query.order("desc").first();
  },
});

/**
 * Update a data source by ID.
 *
 * @example
 * await ctx.runMutation(api.datasources.crud.update, {
 *   id: "...",
 *   updates: { status: "active", config: {...} }
 * })
 */
export const update = mutation({
  args: {
    id: v.id("data_sources"),
    updates: v.object({
      siteId: v.optional(v.id("sites")),
      externalId: v.optional(v.string()),
      isPrimary: v.optional(v.boolean()),
      status: v.optional(statusValidator),
      config: v.optional(v.any()),
      metadata: v.optional(v.any()),
      credentialExpirationAt: v.optional(v.number()),
      lastSyncAt: v.optional(v.number()),
    }),
  },
  handler: async (ctx, args) => {
    const identity = await isAuthenticated(ctx);
    const dataSource = await ctx.db.get(args.id);

    if (!dataSource) {
      throw new Error("Data source not found");
    }

    await isValidTenant(identity.tenantId, dataSource.tenantId);

    // Update with automatic timestamp
    await ctx.db.patch(args.id, {
      ...args.updates,
      updatedAt: Date.now(),
    });

    return await ctx.db.get(args.id);
  },
});

/**
 * Delete a data source by ID (soft delete using deletedAt).
 *
 * @example
 * await ctx.runMutation(api.datasources.crud.delete, { id: "..." })
 */
export const deleteDataSource = mutation({
  args: {
    id: v.id("data_sources"),
    hard: v.optional(v.boolean()), // true for hard delete, false/undefined for soft delete
  },
  handler: async (ctx, args) => {
    const identity = await isAuthenticated(ctx);
    const dataSource = await ctx.db.get(args.id);

    if (!dataSource) {
      throw new Error("Data source not found");
    }

    await isValidTenant(identity.tenantId, dataSource.tenantId);

    if (args.hard) {
      // Hard delete
      await ctx.db.delete(args.id);
    } else {
      // Soft delete
      await ctx.db.patch(args.id, {
        status: "inactive",
        deletedAt: Date.now(),
        updatedAt: Date.now(),
      });
    }

    return true;
  },
});
