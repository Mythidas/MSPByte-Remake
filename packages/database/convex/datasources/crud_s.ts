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
  v.literal("error")
);

// ============================================================================
// SHARED HELPER
// ============================================================================

/**
 * Builds a progressive query for data_sources based on provided filters.
 * Note: tenantId is optional for server queries (allows cross-tenant operations)
 */
function buildProgressiveQuery(
  ctx: any,
  tenantId: Id<"tenants"> | undefined,
  filters: {
    integrationId?: Id<"integrations">;
    isPrimary?: boolean;
    siteId?: Id<"sites">;
    status?: "active" | "inactive" | "error";
  }
): Query<DataModel["data_sources"]> {
  const { integrationId, isPrimary, siteId, status } = filters;

  // Progressive index selection with optional tenant filtering
  if (integrationId && isPrimary !== undefined && tenantId) {
    return ctx.db
      .query("data_sources")
      .withIndex("by_integration_primary", (q: any) =>
        q
          .eq("integrationId", integrationId)
          .eq("isPrimary", isPrimary)
          .eq("tenantId", tenantId)
      );
  } else if (integrationId && tenantId) {
    return ctx.db
      .query("data_sources")
      .withIndex("by_integration_ordered", (q: any) =>
        q.eq("integrationId", integrationId).eq("tenantId", tenantId)
      );
  } else if (siteId && tenantId) {
    return ctx.db
      .query("data_sources")
      .withIndex("by_site_ordered", (q: any) =>
        q.eq("siteId", siteId).eq("tenantId", tenantId)
      );
  } else if (status && tenantId) {
    return ctx.db
      .query("data_sources")
      .withIndex("by_status", (q: any) =>
        q.eq("status", status).eq("tenantId", tenantId)
      );
  } else if (tenantId) {
    // Tenant-only filter
    return ctx.db
      .query("data_sources")
      .withIndex("by_status", (q: any) => q.eq("status", "active").eq("tenantId", tenantId))
      .filter((q: any) =>
        q.or(
          q.eq(q.field("status"), "active"),
          q.eq(q.field("status"), "inactive"),
          q.eq(q.field("status"), "error")
        )
      );
  } else {
    // No tenant filter - return all data sources (admin use case)
    return ctx.db.query("data_sources");
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
    integrationId: v.optional(v.id("integrations")),
    isPrimary: v.optional(v.boolean()),
    siteId: v.optional(v.id("sites")),
    status: v.optional(statusValidator),
    order: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
    paginationOpts: v.optional(paginationOptsValidator),
  },
  handler: async (ctx, args) => {
    await isValidSecret(args.secret);
    const { secret, order = "desc", paginationOpts, tenantId, ...filters } = args;

    // Build progressive query
    let indexedQuery = buildProgressiveQuery(ctx, tenantId, filters);

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
 * Server-side get with secret authentication.
 * Supports both direct ID lookup and filter-based queries.
 */
export const get = query({
  args: {
    secret: v.string(),
    id: v.optional(v.id("data_sources")),
    tenantId: v.optional(v.id("tenants")),
    integrationId: v.optional(v.id("integrations")),
    isPrimary: v.optional(v.boolean()),
    siteId: v.optional(v.id("sites")),
    status: v.optional(statusValidator),
    externalId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await isValidSecret(args.secret);

    // Direct ID lookup mode
    if (args.id) {
      return await ctx.db.get(args.id);
    }

    // Filter-based mode - special case for externalId lookup
    if (args.externalId && args.tenantId) {
      return await ctx.db
        .query("data_sources")
        .withIndex("by_external_id", (q) =>
          q.eq("externalId", args.externalId!).eq("tenantId", args.tenantId!)
        )
        .first();
    }

    // Filter-based mode - use progressive query builder
    const { secret, id, externalId, tenantId, ...filters } = args;
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
    integrationId: v.id("integrations"),
    siteId: v.optional(v.id("sites")),
    externalId: v.optional(v.string()),
    isPrimary: v.boolean(),
    status: statusValidator,
    config: v.any(),
    metadata: v.optional(v.any()),
    credentialExpirationAt: v.number(),
    lastSyncAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await isValidSecret(args.secret);
    const { secret, ...data } = args;

    const dataSourceId = await ctx.db.insert("data_sources", {
      ...data,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return await ctx.db.get(dataSourceId);
  },
});

/**
 * Server-side update with secret authentication.
 */
export const update = mutation({
  args: {
    secret: v.string(),
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
    await isValidSecret(args.secret);

    const dataSource = await ctx.db.get(args.id);
    if (!dataSource) {
      throw new Error("Data source not found");
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
export const deleteDataSource = mutation({
  args: {
    secret: v.string(),
    id: v.id("data_sources"),
    hard: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await isValidSecret(args.secret);

    const dataSource = await ctx.db.get(args.id);
    if (!dataSource) {
      throw new Error("Data source not found");
    }

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
