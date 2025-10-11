import { v } from "convex/values";
import { query, mutation } from "../_generated/server.js";
import { isValidSecret } from "../helpers/validators.js";
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
 * Note: tenantId is optional for server queries (allows cross-tenant operations)
 */
function buildProgressiveQuery(
  ctx: any,
  tenantId: Id<"tenants"> | undefined,
  filters: {
    status?: "active" | "inactive" | "archived";
    slug?: string;
    psaCompanyId?: string;
  }
): Query<DataModel["sites"]> {
  const { status, slug, psaCompanyId } = filters;

  // Progressive index selection with optional tenant filtering
  if (status && tenantId) {
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
  } else if (tenantId) {
    // Tenant-only query with time ordering
    return ctx.db
      .query("sites")
      .withIndex("by_tenant_ordered", (q: any) => q.eq("tenantId", tenantId));
  } else {
    // No tenant filter - return all sites (admin use case)
    return ctx.db.query("sites");
  }
}

// ============================================================================
// SERVER CRUD OPERATIONS
// ============================================================================

/**
 * Server-side list with secret authentication.
 * Allows optional tenantId for cross-tenant queries.
 */
export const list = query({
  args: {
    secret: v.string(),
    tenantId: v.optional(v.id("tenants")),
    status: v.optional(statusValidator),
    slug: v.optional(v.string()),
    psaCompanyId: v.optional(v.string()),
    order: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
    paginationOpts: v.optional(paginationOptsValidator),
  },
  handler: async (ctx, args) => {
    await isValidSecret(args.secret);
    const { secret, order = "desc", paginationOpts, tenantId, ...filters } = args;

    // Build progressive query
    let indexedQuery = buildProgressiveQuery(ctx, tenantId, filters);

    // Apply ordering
    let query: OrderedQuery<DataModel["sites"]> = indexedQuery;
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
 * Server-side get with secret authentication.
 * Supports both direct ID lookup and filter-based queries.
 */
export const get = query({
  args: {
    secret: v.string(),
    id: v.optional(v.id("sites")),
    tenantId: v.optional(v.id("tenants")),
    status: v.optional(statusValidator),
    slug: v.optional(v.string()),
    psaCompanyId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await isValidSecret(args.secret);

    // Direct ID lookup mode
    if (args.id) {
      return await ctx.db.get(args.id);
    }

    // Filter-based mode - use progressive query builder
    const { secret, id, tenantId, ...filters } = args;
    const query = buildProgressiveQuery(ctx, tenantId, filters);

    // Always get newest record when using filters
    return await query.order("desc").first();
  },
});

/**
 * Server-side create with secret authentication.
 */
export const create = mutation({
  args: {
    secret: v.string(),
    tenantId: v.id("tenants"),
    name: v.string(),
    slug: v.string(),
    status: statusValidator,
    psaIntegrationId: v.optional(v.id("integrations")),
    psaCompanyId: v.optional(v.string()),
    psaParentCompanyId: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    await isValidSecret(args.secret);
    const { secret, ...data } = args;

    const siteId = await ctx.db.insert("sites", {
      ...data,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return await ctx.db.get(siteId);
  },
});

/**
 * Server-side update with secret authentication.
 */
export const update = mutation({
  args: {
    secret: v.string(),
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
    await isValidSecret(args.secret);

    const site = await ctx.db.get(args.id);
    if (!site) {
      throw new Error("Site not found");
    }

    // Update with automatic timestamp
    await ctx.db.patch(args.id, {
      ...args.updates,
      updatedAt: Date.now(),
    });

    return await ctx.db.get(args.id);
  },
});

/**
 * Server-side delete with secret authentication.
 * Supports both soft delete (default) and hard delete.
 */
export const deleteSite = mutation({
  args: {
    secret: v.string(),
    id: v.id("sites"),
    hard: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await isValidSecret(args.secret);

    const site = await ctx.db.get(args.id);
    if (!site) {
      throw new Error("Site not found");
    }

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
