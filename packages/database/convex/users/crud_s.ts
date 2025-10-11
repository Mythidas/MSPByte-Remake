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
  v.literal("pending")
);

// ============================================================================
// SHARED HELPER
// ============================================================================

/**
 * Builds a progressive query for users based on provided filters.
 * Note: tenantId is optional for server queries (allows cross-tenant operations)
 */
function buildProgressiveQuery(
  ctx: any,
  tenantId: Id<"tenants"> | undefined,
  filters: {
    clerkId?: string;
    email?: string;
    status?: "active" | "inactive" | "pending";
    roleId?: Id<"roles">;
  }
): Query<DataModel["users"]> {
  const { clerkId, email, status } = filters;

  // Progressive index selection with optional tenant filtering
  if (clerkId) {
    return ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q: any) => q.eq("clerkId", clerkId));
  } else if (email) {
    return ctx.db
      .query("users")
      .withIndex("by_email", (q: any) => q.eq("email", email));
  } else if (status) {
    return ctx.db
      .query("users")
      .withIndex("by_status", (q: any) => q.eq("status", status));
  } else if (tenantId) {
    // Fallback to tenant-only query with time ordering
    return ctx.db
      .query("users")
      .withIndex("by_tenant_ordered", (q: any) => q.eq("tenantId", tenantId));
  } else {
    // No tenant filter - return all users (admin use case)
    return ctx.db.query("users");
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
    clerkId: v.optional(v.string()),
    email: v.optional(v.string()),
    status: v.optional(statusValidator),
    roleId: v.optional(v.id("roles")),
    order: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
    paginationOpts: v.optional(paginationOptsValidator),
  },
  handler: async (ctx, args) => {
    await isValidSecret(args.secret);
    const { secret, order = "desc", paginationOpts, tenantId, ...filters } = args;

    // Build progressive query
    let indexedQuery = buildProgressiveQuery(ctx, tenantId, filters);

    let query: OrderedQuery<DataModel["users"]> = indexedQuery;
    query = indexedQuery.order(order);

    // Apply additional filter for roleId if provided (not in index)
    if (filters.roleId) {
      query = query.filter((q) => q.eq(q.field("roleId"), filters.roleId!));
    }

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
    id: v.optional(v.id("users")),
    tenantId: v.optional(v.id("tenants")),
    clerkId: v.optional(v.string()),
    email: v.optional(v.string()),
    status: v.optional(statusValidator),
    roleId: v.optional(v.id("roles")),
  },
  handler: async (ctx, args) => {
    await isValidSecret(args.secret);

    // Direct ID lookup mode
    if (args.id) {
      return await ctx.db.get(args.id);
    }

    // Filter-based mode - use progressive query builder
    const { secret, id, tenantId, ...filters } = args;
    let query = buildProgressiveQuery(ctx, tenantId, filters);

    // Apply additional filter for roleId if provided (not in index)
    if (filters.roleId) {
      query = query.filter((q) => q.eq(q.field("roleId"), filters.roleId!));
    }

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
    roleId: v.id("roles"),
    clerkId: v.string(),
    email: v.string(),
    name: v.string(),
    status: statusValidator,
    metadata: v.object({
      currentSite: v.optional(v.id("sites")),
    }),
    lastActivityAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await isValidSecret(args.secret);
    const { secret, ...data } = args;

    const userId = await ctx.db.insert("users", {
      ...data,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return await ctx.db.get(userId);
  },
});

/**
 * Server-side update with secret authentication.
 */
export const update = mutation({
  args: {
    secret: v.string(),
    id: v.id("users"),
    updates: v.object({
      roleId: v.optional(v.id("roles")),
      email: v.optional(v.string()),
      name: v.optional(v.string()),
      status: v.optional(statusValidator),
      metadata: v.optional(
        v.object({
          currentSite: v.optional(v.id("sites")),
        })
      ),
      lastActivityAt: v.optional(v.number()),
    }),
  },
  handler: async (ctx, args) => {
    await isValidSecret(args.secret);

    const user = await ctx.db.get(args.id);
    if (!user) {
      throw new Error("User not found");
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
export const deleteUser = mutation({
  args: {
    secret: v.string(),
    id: v.id("users"),
    hard: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await isValidSecret(args.secret);

    const user = await ctx.db.get(args.id);
    if (!user) {
      throw new Error("User not found");
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
