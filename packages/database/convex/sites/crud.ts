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
  v.literal("archived")
);

// ============================================================================
// SHARED HELPER
// ============================================================================

/**
 * Builds a progressive query for sites based on provided filters.
 * Selects the most efficient index based on which filters are provided.
 */
function buildProgressiveQuery(
  ctx: any,
  tenantId: Id<"tenants">,
  filters: {
    status?: "active" | "inactive" | "archived";
    slug?: string;
    psaCompanyId?: string;
  }
): Query<DataModel["sites"]> {
  const { status, slug, psaCompanyId } = filters;

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
  },
  handler: async (ctx, args) => {
    const identity = await isAuthenticated(ctx);
    const { order = "desc", ...filters } = args;

    // Build progressive query
    let indexedQuery = buildProgressiveQuery(ctx, identity.tenantId, filters);

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
    order: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
    sortColumn: v.optional(v.string()),
    sortDirection: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
    globalSearch: v.optional(v.string()),
    paginationOpts: paginationOptsValidator,
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

    // Build progressive query
    let indexedQuery = buildProgressiveQuery(ctx, identity.tenantId, filters);

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
          site.psaCompanyId?.toLowerCase().includes(searchLower)
        );
      });
    }

    // Get paginated results
    const result = await query.paginate(paginationOpts);

    // Batch fetch all unique integrations for enrichment
    const uniqueIntegrationIds = [
      ...new Set(
        result.page
          .map((s) => s.psaIntegrationId)
          .filter((id): id is NonNullable<typeof id> => id !== undefined)
      ),
    ];
    const integrations = await Promise.all(
      uniqueIntegrationIds.map((id) => ctx.db.get(id))
    );

    // Create integration lookup map for O(1) access
    const integrationMap = new Map(
      integrations
        .filter((i): i is NonNullable<typeof i> => i !== null)
        .map((i) => [i._id, i])
    );

    // Enrich sites with psaIntegrationName
    const enrichedSites = result.page.map((site) => ({
      ...site,
      psaIntegrationName: site.psaIntegrationId
        ? integrationMap.get(site.psaIntegrationId)?.name
        : undefined,
    }));

    return {
      ...result,
      page: enrichedSites,
    };
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

    // Update with automatic timestamp
    await ctx.db.patch(args.id, {
      ...args.updates,
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
