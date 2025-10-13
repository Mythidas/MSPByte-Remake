import { v } from "convex/values";
import { query, mutation } from "../_generated/server.js";
import { isAuthenticated, isValidTenant } from "../helpers/validators.js";
import type { OrderedQuery, Query } from "convex/server";
import type { DataModel, Id } from "../_generated/dataModel.js";
import { paginationOptsValidator } from "convex/server";
import { PaginationArgs } from "../types/index.js";

// ============================================================================
// TYPES
// ============================================================================

const statusValidator = v.union(
  v.literal("active"),
  v.literal("inactive"),
  v.literal("archived")
);

// ============================================================================
// SHARED HELPER
// ============================================================================

/**
 * Maps sort columns to their corresponding indices.
 * Allows dynamic sorting by selecting the appropriate index based on sortColumn.
 */
const SORT_INDEX_MAP: Record<string, string> = {
  name: "by_tenant_name",
  psaIntegrationName: "by_tenant_psa",
  psaCompanyId: "by_tenant_psaId",
  status: "by_tenant_status_ordered",
  createdAt: "by_tenant_ordered", // Default
};

/**
 * Builds a progressive query for sites based on provided filters and sort column.
 * Selects the most efficient index based on which filters and sort are provided.
 */
function buildProgressiveQuery(
  ctx: any,
  tenantId: Id<"tenants">,
  filters: {
    status?: "active" | "inactive" | "archived";
    slug?: string;
    psaCompanyId?: string;
  },
  sortColumn?: string
): Query<DataModel["sites"]> {
  const { status, slug, psaCompanyId } = filters;

  // If sorting by a specific column, use that index
  if (sortColumn && SORT_INDEX_MAP[sortColumn]) {
    const indexName = SORT_INDEX_MAP[sortColumn];
    return ctx.db
      .query("sites")
      .withIndex(indexName, (q: any) => q.eq("tenantId", tenantId));
  }

  // Progressive index selection - choose most specific index with time ordering
  if (status) {
    return ctx.db
      .query("sites")
      .withIndex("by_tenant_status_ordered", (q: any) =>
        q.eq("tenantId", tenantId).eq("status", status)
      );
  } else if (slug) {
    return ctx.db
      .query("sites")
      .withIndex("by_slug", (q: any) => q.eq("slug", slug));
  } else if (psaCompanyId) {
    return ctx.db
      .query("sites")
      .withIndex("by_psa_id", (q: any) => q.eq("psaCompanyId", psaCompanyId));
  } else {
    // Fallback to tenant-only query with time ordering
    return ctx.db
      .query("sites")
      .withIndex("by_tenant_ordered", (q: any) => q.eq("tenantId", tenantId));
  }
}

// ============================================================================
// CRUD OPERATIONS
// ============================================================================

/**
 * List sites with optional filtering, ordering, and pagination.
 *
 * @example
 * // Get all active sites
 * await ctx.runQuery(api.sites.crud.list, { status: "active" })
 *
 * @example
 * // Get paginated sites, newest first
 * await ctx.runQuery(api.sites.crud.list, {
 *   order: "desc",
 *   paginationOpts: { numItems: 50, cursor: null }
 * })
 */
export const list = query({
  args: {
    status: v.optional(statusValidator),
    slug: v.optional(v.string()),
    psaCompanyId: v.optional(v.string()),
    order: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
    sortColumn: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await isAuthenticated(ctx);
    const { order = "desc", sortColumn, ...filters } = args;

    // Build progressive query with sortColumn support
    let indexedQuery = buildProgressiveQuery(
      ctx,
      identity.tenantId,
      filters,
      sortColumn
    );

    // Apply ordering
    let query: OrderedQuery<DataModel["sites"]> = indexedQuery;
    query = indexedQuery.order(order);

    // Return paginated or full results
    return await query.collect();
  },
});

export const paginate = query({
  args: {
    status: v.optional(statusValidator),
    slug: v.optional(v.string()),
    psaCompanyId: v.optional(v.string()),
    ...PaginationArgs,
  },
  handler: async (ctx, args) => {
    const identity = await isAuthenticated(ctx);
    const {
      order = "desc",
      paginationOpts,
      sortColumn,
      sortDirection,
      globalSearch,
      ...filters
    } = args;

    // Build progressive query with sortColumn support
    let indexedQuery = buildProgressiveQuery(
      ctx,
      identity.tenantId,
      filters,
      sortColumn
    );

    // Apply ordering (use sortDirection if sortColumn is provided, otherwise use order)
    let query: OrderedQuery<DataModel["sites"]> = indexedQuery;
    const orderDirection = sortColumn && sortDirection ? sortDirection : order;
    query = indexedQuery.order(orderDirection);

    // Apply global search filter if provided
    if (globalSearch && globalSearch.trim()) {
      const searchLower = globalSearch.toLowerCase().trim();
      query = query.filter((q) => {
        const site = q as any;
        return (
          site.name?.toLowerCase().includes(searchLower) ||
          site.slug?.toLowerCase().includes(searchLower) ||
          site.psaCompanyId?.toLowerCase().includes(searchLower) ||
          site.psaIntegrationName?.toLowerCase().includes(searchLower)
        );
      });
    }

    // Get paginated results (psaIntegrationName is already denormalized)
    return await query.paginate(paginationOpts);
  },
});

/**
 * Get a single site - supports both direct ID lookup and filter-based queries.
 *
 * @example
 * // Get by ID
 * await ctx.runQuery(api.sites.crud.get, { id: "..." })
 *
 * @example
 * // Get site by slug
 * await ctx.runQuery(api.sites.crud.get, { slug: "abc123" })
 */
export const get = query({
  args: {
    id: v.optional(v.id("sites")),
    status: v.optional(statusValidator),
    slug: v.optional(v.string()),
    psaCompanyId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await isAuthenticated(ctx);

    // Direct ID lookup mode
    if (args.id) {
      const site = await ctx.db.get(args.id);
      if (site) {
        await isValidTenant(identity.tenantId, site.tenantId);
      }
      return site;
    }

    // Filter-based mode - use progressive query builder
    const { id, ...filters } = args;
    const query = buildProgressiveQuery(ctx, identity.tenantId, filters);

    // Always get newest record when using filters
    return await query.order("desc").first();
  },
});

/**
 * Update a site by ID.
 *
 * @example
 * await ctx.runMutation(api.sites.crud.update, {
 *   id: "...",
 *   updates: { name: "New Name", status: "active" }
 * })
 */
export const update = mutation({
  args: {
    id: v.id("sites"),
    updates: v.object({
      name: v.optional(v.string()),
      slug: v.optional(v.string()),
      status: v.optional(statusValidator),
      psaIntegrationId: v.optional(v.id("integrations")),
      psaCompanyId: v.optional(v.string()),
      psaParentCompanyId: v.optional(v.string()),
      metadata: v.optional(v.any()),
    }),
  },
  handler: async (ctx, args) => {
    const identity = await isAuthenticated(ctx);
    const site = await ctx.db.get(args.id);

    if (!site) {
      throw new Error("Site not found");
    }

    await isValidTenant(identity.tenantId, site.tenantId);

    // If psaIntegrationId is being updated, fetch and denormalize the integration name
    let psaIntegrationName = site.psaIntegrationName;
    if (args.updates.psaIntegrationId !== undefined) {
      if (args.updates.psaIntegrationId) {
        const integration = await ctx.db.get(args.updates.psaIntegrationId);
        psaIntegrationName = integration?.name;
      } else {
        psaIntegrationName = undefined;
      }
    }

    // Update with automatic timestamp and denormalized psaIntegrationName
    await ctx.db.patch(args.id, {
      ...args.updates,
      psaIntegrationName,
      updatedAt: Date.now(),
    });

    return await ctx.db.get(args.id);
  },
});

/**
 * Delete a site by ID (soft delete using deletedAt).
 *
 * @example
 * await ctx.runMutation(api.sites.crud.delete, { id: "..." })
 */
export const deleteSite = mutation({
  args: {
    id: v.id("sites"),
    hard: v.optional(v.boolean()), // true for hard delete, false/undefined for soft delete
  },
  handler: async (ctx, args) => {
    const identity = await isAuthenticated(ctx);
    const site = await ctx.db.get(args.id);

    if (!site) {
      throw new Error("Site not found");
    }

    await isValidTenant(identity.tenantId, site.tenantId);

    if (args.hard) {
      // Hard delete
      await ctx.db.delete(args.id);
    } else {
      // Soft delete
      await ctx.db.patch(args.id, {
        status: "archived",
        deletedAt: Date.now(),
        updatedAt: Date.now(),
      });
    }

    return true;
  },
});
