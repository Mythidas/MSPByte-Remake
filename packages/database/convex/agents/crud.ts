import { v } from "convex/values";
import { query, mutation } from "../_generated/server.js";
import { isAuthenticated, isValidTenant } from "../helpers/validators.js";
import type { OrderedQuery, Query } from "convex/server";
import type { DataModel, Id } from "../_generated/dataModel.js";
import { paginationOptsValidator } from "convex/server";

// ============================================================================
// SHARED HELPER
// ============================================================================

/**
 * Builds a progressive query for agents based on provided filters.
 * Selects the most efficient index based on which filters are provided.
 */
function buildProgressiveQuery(
  ctx: any,
  tenantId: Id<"tenants">,
  filters: {
    siteId?: Id<"sites">;
    guid?: string;
  }
): Query<DataModel["agents"]> {
  const { siteId, guid } = filters;

  // Progressive index selection - choose most specific index with time ordering
  if (guid) {
    return ctx.db
      .query("agents")
      .withIndex("by_guid", (q: any) => q.eq("guid", guid));
  } else if (siteId) {
    return ctx.db
      .query("agents")
      .withIndex("by_site_ordered", (q: any) => q.eq("siteId", siteId));
  } else {
    // Fallback to tenant-only query with time ordering
    return ctx.db
      .query("agents")
      .withIndex("by_tenant_ordered", (q: any) => q.eq("tenantId", tenantId));
  }
}

// ============================================================================
// CRUD OPERATIONS
// ============================================================================

/**
 * List agents with optional filtering, ordering, and pagination.
 *
 * @example
 * // Get all agents for a site
 * await ctx.runQuery(api.agents.crud.list, { siteId: "..." })
 *
 * @example
 * // Get paginated agents, newest first
 * await ctx.runQuery(api.agents.crud.list, {
 *   order: "desc",
 *   paginationOpts: { numItems: 50, cursor: null }
 * })
 */
export const list = query({
  args: {
    siteId: v.optional(v.id("sites")),
    guid: v.optional(v.string()),
    order: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
  },
  handler: async (ctx, args) => {
    const identity = await isAuthenticated(ctx);
    const { order = "desc", ...filters } = args;

    // Build progressive query
    let indexedQuery = buildProgressiveQuery(ctx, identity.tenantId, filters);

    // Apply ordering
    let query: OrderedQuery<DataModel["agents"]> = indexedQuery;
    query = indexedQuery.order(order);

    // Return paginated or full results
    return await query.collect();
  },
});

export const paginate = query({
  args: {
    siteId: v.optional(v.id("sites")),
    guid: v.optional(v.string()),
    order: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const identity = await isAuthenticated(ctx);
    const { order = "desc", paginationOpts, ...filters } = args;

    // Build progressive query
    let indexedQuery = buildProgressiveQuery(ctx, identity.tenantId, filters);

    // Apply ordering
    let query: OrderedQuery<DataModel["agents"]> = indexedQuery;
    query = indexedQuery.order(order);

    // Return paginated or full results
    return await query.paginate(paginationOpts);
  },
});

/**
 * Get a single agent - supports both direct ID lookup and filter-based queries.
 *
 * @example
 * // Get by ID
 * await ctx.runQuery(api.agents.crud.get, { id: "..." })
 *
 * @example
 * // Get agent by GUID
 * await ctx.runQuery(api.agents.crud.get, { guid: "..." })
 */
export const get = query({
  args: {
    id: v.optional(v.id("agents")),
    siteId: v.optional(v.id("sites")),
    guid: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await isAuthenticated(ctx);

    // Direct ID lookup mode
    if (args.id) {
      const agent = await ctx.db.get(args.id);
      if (agent) {
        await isValidTenant(identity.tenantId, agent.tenantId);
      }
      return agent;
    }

    // Filter-based mode - use progressive query builder
    const { id, ...filters } = args;
    const query = buildProgressiveQuery(ctx, identity.tenantId, filters);

    // Always get newest record when using filters
    return await query.order("desc").first();
  },
});

/**
 * Update an agent by ID.
 *
 * @example
 * await ctx.runMutation(api.agents.crud.update, {
 *   id: "...",
 *   updates: { hostname: "new-host", lastCheckinAt: Date.now() }
 * })
 */
export const update = mutation({
  args: {
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
    const identity = await isAuthenticated(ctx);
    const agent = await ctx.db.get(args.id);

    if (!agent) {
      throw new Error("Agent not found");
    }

    await isValidTenant(identity.tenantId, agent.tenantId);

    // Update with automatic timestamp
    await ctx.db.patch(args.id, {
      ...args.updates,
      updatedAt: Date.now(),
    });

    return await ctx.db.get(args.id);
  },
});

/**
 * Delete an agent by ID (soft delete using deletedAt).
 *
 * @example
 * await ctx.runMutation(api.agents.crud.delete, { id: "..." })
 */
export const deleteAgent = mutation({
  args: {
    id: v.id("agents"),
    hard: v.optional(v.boolean()), // true for hard delete, false/undefined for soft delete
  },
  handler: async (ctx, args) => {
    const identity = await isAuthenticated(ctx);
    const agent = await ctx.db.get(args.id);

    if (!agent) {
      throw new Error("Agent not found");
    }

    await isValidTenant(identity.tenantId, agent.tenantId);

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
