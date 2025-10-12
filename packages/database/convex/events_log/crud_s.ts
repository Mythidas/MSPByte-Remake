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
  v.literal("pending"),
  v.literal("processing"),
  v.literal("completed"),
  v.literal("failed")
);

// ============================================================================
// SHARED HELPER
// ============================================================================

/**
 * Builds a progressive query for events_log based on provided filters.
 * Note: tenantId is optional for server queries (allows cross-tenant operations)
 */
function buildProgressiveQuery(
  ctx: any,
  tenantId: Id<"tenants"> | undefined,
  filters: {
    entityId?: Id<"entities">;
    status?: "pending" | "processing" | "completed" | "failed";
    eventType?: string;
  }
): Query<DataModel["events_log"]> {
  const { entityId, status, eventType } = filters;

  // Progressive index selection with optional tenant filtering
  if (entityId) {
    return ctx.db
      .query("events_log")
      .withIndex("by_entity", (q: any) => q.eq("entityId", entityId));
  } else if (status) {
    return ctx.db
      .query("events_log")
      .withIndex("by_status", (q: any) => q.eq("status", status));
  } else if (eventType) {
    return ctx.db
      .query("events_log")
      .withIndex("by_type", (q: any) => q.eq("eventType", eventType));
  } else if (tenantId) {
    return ctx.db
      .query("events_log")
      .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenantId));
  } else {
    // No filters - return all events
    return ctx.db.query("events_log");
  }
}

// ============================================================================
// SERVER CRUD OPERATIONS
// ============================================================================

/**
 * Server-side list with secret authentication.
 * Always returns full array of results (no pagination).
 * Allows optional tenantId for cross-tenant queries.
 */
export const list = query({
  args: {
    secret: v.string(),
    tenantId: v.optional(v.id("tenants")),
    entityId: v.optional(v.id("entities")),
    status: v.optional(statusValidator),
    eventType: v.optional(v.string()),
    order: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
  },
  handler: async (ctx, args) => {
    await isValidSecret(args.secret);
    const { secret, order = "desc", tenantId, ...filters } = args;

    // Build progressive query
    let indexedQuery = buildProgressiveQuery(ctx, tenantId, filters);

    // Apply ordering
    let query: OrderedQuery<DataModel["events_log"]> = indexedQuery;
    query = indexedQuery.order(order);

    return await query.collect();
  },
});

/**
 * Server-side paginated list with secret authentication.
 * Returns paginated results for large datasets.
 * Allows optional tenantId for cross-tenant queries.
 */
export const paginate = query({
  args: {
    secret: v.string(),
    tenantId: v.optional(v.id("tenants")),
    entityId: v.optional(v.id("entities")),
    status: v.optional(statusValidator),
    eventType: v.optional(v.string()),
    order: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    await isValidSecret(args.secret);
    const { secret, order = "desc", paginationOpts, tenantId, ...filters } = args;

    // Build progressive query
    let indexedQuery = buildProgressiveQuery(ctx, tenantId, filters);

    // Apply ordering
    let query: OrderedQuery<DataModel["events_log"]> = indexedQuery;
    query = indexedQuery.order(order);

    return await query.paginate(paginationOpts);
  },
});

/**
 * Server-side get with secret authentication.
 * Supports both direct ID lookup and filter-based queries.
 */
export const get = query({
  args: {
    secret: v.string(),
    id: v.optional(v.id("events_log")),
    tenantId: v.optional(v.id("tenants")),
    entityId: v.optional(v.id("entities")),
    status: v.optional(statusValidator),
    eventType: v.optional(v.string()),
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
    entityId: v.id("entities"),
    eventType: v.string(),
    status: statusValidator,
    payload: v.any(),
    processedAt: v.number(),
    retryCount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await isValidSecret(args.secret);
    const { secret, ...data } = args;

    const eventId = await ctx.db.insert("events_log", {
      ...data,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return await ctx.db.get(eventId);
  },
});

/**
 * Server-side update with secret authentication.
 */
export const update = mutation({
  args: {
    secret: v.string(),
    id: v.id("events_log"),
    updates: v.object({
      status: v.optional(statusValidator),
      payload: v.optional(v.any()),
      processedAt: v.optional(v.number()),
      retryCount: v.optional(v.number()),
    }),
  },
  handler: async (ctx, args) => {
    await isValidSecret(args.secret);

    const event = await ctx.db.get(args.id);
    if (!event) {
      throw new Error("Event not found");
    }

    // Update with automatic timestamp
    await ctx.db.patch(args.id, {
      ...args.updates,
      updatedAt: Date.now(),
    });

    return await ctx.db.get(args.id);
  },
});
