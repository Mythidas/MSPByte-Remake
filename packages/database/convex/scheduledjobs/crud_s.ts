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
  v.literal("running"),
  v.literal("completed"),
  v.literal("failed")
);

// ============================================================================
// SHARED HELPER
// ============================================================================

/**
 * Builds a progressive query for scheduled_jobs based on provided filters.
 * Note: tenantId is optional for server queries (allows cross-tenant operations)
 */
function buildProgressiveQuery(
  ctx: any,
  tenantId: Id<"tenants"> | undefined,
  filters: {
    dataSourceId?: Id<"data_sources">;
    integrationId?: Id<"integrations">;
    status?: "pending" | "running" | "completed" | "failed";
  }
): Query<DataModel["scheduled_jobs"]> {
  const { dataSourceId, integrationId, status } = filters;

  // Progressive index selection with optional tenant filtering
  if (dataSourceId && status && tenantId) {
    return ctx.db
      .query("scheduled_jobs")
      .withIndex("by_data_source_status", (q: any) =>
        q
          .eq("dataSourceId", dataSourceId)
          .eq("status", status)
          .eq("tenantId", tenantId)
      );
  } else if (dataSourceId && tenantId) {
    return ctx.db
      .query("scheduled_jobs")
      .withIndex("by_data_source", (q: any) =>
        q.eq("dataSourceId", dataSourceId).eq("tenantId", tenantId)
      );
  } else if (integrationId) {
    return ctx.db
      .query("scheduled_jobs")
      .withIndex("by_integration", (q: any) =>
        q.eq("integrationId", integrationId)
      );
  } else if (status) {
    return ctx.db
      .query("scheduled_jobs")
      .withIndex("by_status", (q: any) => q.eq("status", status));
  } else if (tenantId) {
    // Fallback to tenant-only query
    return ctx.db
      .query("scheduled_jobs")
      .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenantId));
  } else {
    // No tenant filter - return all jobs (admin use case)
    return ctx.db.query("scheduled_jobs");
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
    dataSourceId: v.optional(v.id("data_sources")),
    integrationId: v.optional(v.id("integrations")),
    status: v.optional(statusValidator),
    order: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
  },
  handler: async (ctx, args) => {
    await isValidSecret(args.secret);
    const { secret, order = "desc", tenantId, ...filters } = args;

    // Build progressive query
    let indexedQuery = buildProgressiveQuery(ctx, tenantId, filters);

    // Apply ordering
    let query: OrderedQuery<DataModel["scheduled_jobs"]> = indexedQuery;
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
    dataSourceId: v.optional(v.id("data_sources")),
    integrationId: v.optional(v.id("integrations")),
    status: v.optional(statusValidator),
    order: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    await isValidSecret(args.secret);
    const {
      secret,
      order = "desc",
      paginationOpts,
      tenantId,
      ...filters
    } = args;

    // Build progressive query
    let indexedQuery = buildProgressiveQuery(ctx, tenantId, filters);

    // Apply ordering
    let query: OrderedQuery<DataModel["scheduled_jobs"]> = indexedQuery;
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
    id: v.optional(v.id("scheduled_jobs")),
    tenantId: v.optional(v.id("tenants")),
    dataSourceId: v.optional(v.id("data_sources")),
    integrationId: v.optional(v.id("integrations")),
    status: v.optional(statusValidator),
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
    integrationId: v.id("integrations"),
    integrationSlug: v.string(),
    dataSourceId: v.optional(v.id("data_sources")),
    action: v.string(),
    payload: v.any(),
    priority: v.optional(v.number()),
    status: statusValidator,
    attempts: v.optional(v.number()),
    attemptsMax: v.optional(v.number()),
    nextRetryAt: v.optional(v.number()),
    scheduledAt: v.number(),
    startedAt: v.optional(v.number()),
    error: v.optional(v.string()),
    createdBy: v.string(),
  },
  handler: async (ctx, args) => {
    await isValidSecret(args.secret);
    const { secret, ...data } = args;

    const jobId = await ctx.db.insert("scheduled_jobs", {
      ...data,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return await ctx.db.get(jobId);
  },
});

/**
 * Server-side update with secret authentication.
 */
export const update = mutation({
  args: {
    secret: v.string(),
    id: v.id("scheduled_jobs"),
    updates: v.object({
      status: v.optional(statusValidator),
      attempts: v.optional(v.number()),
      nextRetryAt: v.optional(v.number()),
      scheduledAt: v.optional(v.number()),
      startedAt: v.optional(v.number()),
      error: v.optional(v.string()),
      payload: v.optional(v.any()),
    }),
  },
  handler: async (ctx, args) => {
    await isValidSecret(args.secret);

    const job = await ctx.db.get(args.id);
    if (!job) {
      throw new Error("Scheduled job not found");
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
 * Hard delete only (scheduled_jobs doesn't support soft delete).
 */
export const deleteJob = mutation({
  args: {
    secret: v.string(),
    id: v.id("scheduled_jobs"),
  },
  handler: async (ctx, args) => {
    await isValidSecret(args.secret);

    const job = await ctx.db.get(args.id);
    if (!job) {
      throw new Error("Scheduled job not found");
    }

    await ctx.db.delete(args.id);
    return true;
  },
});
