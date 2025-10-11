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
 * Selects the most efficient index based on which filters are provided.
 */
function buildProgressiveQuery(
  ctx: any,
  tenantId: Id<"tenants">,
  filters: {
    dataSourceId?: Id<"data_sources">;
    integrationId?: Id<"integrations">;
    status?: "pending" | "running" | "completed" | "failed";
  }
): Query<DataModel["scheduled_jobs"]> {
  const { dataSourceId, integrationId, status } = filters;

  // Progressive index selection - choose most specific index
  if (dataSourceId && status) {
    return ctx.db
      .query("scheduled_jobs")
      .withIndex("by_data_source_status", (q: any) =>
        q
          .eq("dataSourceId", dataSourceId)
          .eq("status", status)
          .eq("tenantId", tenantId)
      );
  } else if (dataSourceId) {
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
  } else {
    // Fallback to tenant-only query
    return ctx.db
      .query("scheduled_jobs")
      .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenantId));
  }
}

// ============================================================================
// CRUD OPERATIONS
// ============================================================================

/**
 * List scheduled jobs with optional filtering, ordering, and pagination.
 *
 * @example
 * // Get all failed jobs for a data source
 * await ctx.runQuery(api.scheduledjobs.crud.list, {
 *   dataSourceId: "...",
 *   status: "failed"
 * })
 *
 * @example
 * // Get paginated pending jobs, newest first
 * await ctx.runQuery(api.scheduledjobs.crud.list, {
 *   status: "pending",
 *   order: "desc",
 *   paginationOpts: { numItems: 50, cursor: null }
 * })
 */
export const list = query({
  args: {
    dataSourceId: v.optional(v.id("data_sources")),
    integrationId: v.optional(v.id("integrations")),
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
    let query: OrderedQuery<DataModel["scheduled_jobs"]> = indexedQuery;
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
 * Get a single scheduled job - supports both direct ID lookup and filter-based queries.
 *
 * @example
 * // Get by ID
 * await ctx.runQuery(api.scheduledjobs.crud.get, { id: "..." })
 *
 * @example
 * // Get newest failed job for a data source
 * await ctx.runQuery(api.scheduledjobs.crud.get, {
 *   dataSourceId: "...",
 *   status: "failed"
 * })
 */
export const get = query({
  args: {
    id: v.optional(v.id("scheduled_jobs")),
    dataSourceId: v.optional(v.id("data_sources")),
    integrationId: v.optional(v.id("integrations")),
    status: v.optional(statusValidator),
  },
  handler: async (ctx, args) => {
    const identity = await isAuthenticated(ctx);

    // Direct ID lookup mode
    if (args.id) {
      const job = await ctx.db.get(args.id);
      if (job) {
        await isValidTenant(identity.tenantId, job.tenantId);
      }
      return job;
    }

    // Filter-based mode - use progressive query builder
    const { id, ...filters } = args;
    const query = buildProgressiveQuery(ctx, identity.tenantId, filters);

    // Always get newest record when using filters
    return await query.order("desc").first();
  },
});

/**
 * Update a scheduled job by ID.
 *
 * @example
 * await ctx.runMutation(api.scheduledjobs.crud.update, {
 *   id: "...",
 *   updates: { status: "completed", startedAt: Date.now() }
 * })
 */
export const update = mutation({
  args: {
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
    const identity = await isAuthenticated(ctx);
    const job = await ctx.db.get(args.id);

    if (!job) {
      throw new Error("Scheduled job not found");
    }

    await isValidTenant(identity.tenantId, job.tenantId);

    // Update with automatic timestamp
    await ctx.db.patch(args.id, {
      ...args.updates,
      updatedAt: Date.now(),
    });

    return await ctx.db.get(args.id);
  },
});

/**
 * Delete a scheduled job by ID (hard delete only, no soft delete).
 *
 * @example
 * await ctx.runMutation(api.scheduledjobs.crud.delete, { id: "..." })
 */
export const deleteJob = mutation({
  args: {
    id: v.id("scheduled_jobs"),
  },
  handler: async (ctx, args) => {
    const identity = await isAuthenticated(ctx);
    const job = await ctx.db.get(args.id);

    if (!job) {
      throw new Error("Scheduled job not found");
    }

    await isValidTenant(identity.tenantId, job.tenantId);

    await ctx.db.delete(args.id);
    return true;
  },
});
