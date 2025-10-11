import { v } from "convex/values";
import { query, mutation } from "../_generated/server.js";
import { isValidSecret } from "../helpers/validators.js";
import type { OrderedQuery, Query } from "convex/server";
import type { DataModel, Id } from "../_generated/dataModel.js";
import { paginationOptsValidator } from "convex/server";

// ============================================================================
// SHARED HELPER
// ============================================================================

/**
 * Builds a progressive query for agents based on provided filters.
 * Note: tenantId is optional for server queries (allows cross-tenant operations)
 */
function buildProgressiveQuery(
  ctx: any,
  tenantId: Id<"tenants"> | undefined,
  filters: {
    siteId?: Id<"sites">;
    guid?: string;
  }
): Query<DataModel["agents"]> {
  const { siteId, guid } = filters;

  // Progressive index selection with optional tenant filtering
  if (guid) {
    return ctx.db
      .query("agents")
      .withIndex("by_guid", (q: any) => q.eq("guid", guid));
  } else if (siteId) {
    return ctx.db
      .query("agents")
      .withIndex("by_site_ordered", (q: any) => q.eq("siteId", siteId));
  } else if (tenantId) {
    // Tenant-only query with time ordering
    return ctx.db
      .query("agents")
      .withIndex("by_tenant_ordered", (q: any) => q.eq("tenantId", tenantId));
  } else {
    // No tenant filter - return all agents (admin use case)
    return ctx.db.query("agents");
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
    siteId: v.optional(v.id("sites")),
    guid: v.optional(v.string()),
    order: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
    paginationOpts: v.optional(paginationOptsValidator),
  },
  handler: async (ctx, args) => {
    await isValidSecret(args.secret);
    const { secret, order = "desc", paginationOpts, tenantId, ...filters } = args;

    // Build progressive query
    let indexedQuery = buildProgressiveQuery(ctx, tenantId, filters);

    // Apply ordering
    let query: OrderedQuery<DataModel["agents"]> = indexedQuery;
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
    id: v.optional(v.id("agents")),
    tenantId: v.optional(v.id("tenants")),
    siteId: v.optional(v.id("sites")),
    guid: v.optional(v.string()),
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
    siteId: v.id("sites"),
    guid: v.string(),
    hostname: v.string(),
    platform: v.string(),
    version: v.string(),
    ipAddress: v.optional(v.string()),
    macAddress: v.optional(v.string()),
    extAddress: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await isValidSecret(args.secret);
    const { secret, ...data } = args;

    const agentId = await ctx.db.insert("agents", {
      ...data,
      registeredAt: Date.now(),
      lastCheckinAt: Date.now(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return await ctx.db.get(agentId);
  },
});

/**
 * Server-side update with secret authentication.
 */
export const update = mutation({
  args: {
    secret: v.string(),
    id: v.id("agents"),
    updates: v.object({
      siteId: v.optional(v.id("sites")),
      guid: v.optional(v.string()),
      hostname: v.optional(v.string()),
      platform: v.optional(v.string()),
      version: v.optional(v.string()),
      ipAddress: v.optional(v.string()),
      macAddress: v.optional(v.string()),
      extAddress: v.optional(v.string()),
      registeredAt: v.optional(v.number()),
      lastCheckinAt: v.optional(v.number()),
    }),
  },
  handler: async (ctx, args) => {
    await isValidSecret(args.secret);

    const agent = await ctx.db.get(args.id);
    if (!agent) {
      throw new Error("Agent not found");
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
export const deleteAgent = mutation({
  args: {
    secret: v.string(),
    id: v.id("agents"),
    hard: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await isValidSecret(args.secret);

    const agent = await ctx.db.get(args.id);
    if (!agent) {
      throw new Error("Agent not found");
    }

    if (args.hard) {
      // Hard delete
      await ctx.db.delete(args.id);
    } else {
      // Soft delete
      await ctx.db.patch(args.id, {
        deletedAt: Date.now(),
        updatedAt: Date.now(),
      });
    }

    return true;
  },
});
