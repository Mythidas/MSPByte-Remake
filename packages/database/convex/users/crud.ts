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
  v.literal("pending")
);

// ============================================================================
// SHARED HELPER
// ============================================================================

/**
 * Builds a progressive query for users based on provided filters.
 * Selects the most efficient index based on which filters are provided.
 */
function buildProgressiveQuery(
  ctx: any,
  tenantId: Id<"tenants">,
  filters: {
    clerkId?: string;
    email?: string;
    status?: "active" | "inactive" | "pending";
    roleId?: Id<"roles">;
  }
): Query<DataModel["users"]> {
  const { clerkId, email, status } = filters;

  // Progressive index selection - choose most specific index with time ordering
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
  } else {
    // Fallback to tenant-only query with time ordering
    return ctx.db
      .query("users")
      .withIndex("by_tenant_ordered", (q: any) => q.eq("tenantId", tenantId));
  }
}

// ============================================================================
// CRUD OPERATIONS
// ============================================================================

/**
 * List users with optional filtering, ordering, and pagination.
 *
 * @example
 * // Get all active users
 * await ctx.runQuery(api.users.crud.list, { status: "active" })
 *
 * @example
 * // Get paginated users, newest first
 * await ctx.runQuery(api.users.crud.list, {
 *   order: "desc",
 *   paginationOpts: { numItems: 50, cursor: null }
 * })
 */
export const list = query({
  args: {
    clerkId: v.optional(v.string()),
    email: v.optional(v.string()),
    status: v.optional(statusValidator),
    roleId: v.optional(v.id("roles")),
    order: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
  },
  handler: async (ctx, args) => {
    const identity = await isAuthenticated(ctx);
    const { order = "desc", ...filters } = args;

    // Build progressive query
    let indexedQuery = buildProgressiveQuery(ctx, identity.tenantId, filters);

    let query: OrderedQuery<DataModel["users"]> = indexedQuery;
    query = indexedQuery.order(order);

    // Apply additional filter for roleId if provided (not in index)
    if (filters.roleId) {
      query = query.filter((q) => q.eq(q.field("roleId"), filters.roleId!));
    }

    // Return paginated or full results
    return await query.collect();
  },
});

export const paginate = query({
  args: {
    clerkId: v.optional(v.string()),
    email: v.optional(v.string()),
    status: v.optional(statusValidator),
    roleId: v.optional(v.id("roles")),
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

    let query: OrderedQuery<DataModel["users"]> = indexedQuery;
    const orderDirection = sortColumn && sortDirection ? sortDirection : order;
    query = indexedQuery.order(orderDirection);

    // Apply additional filter for roleId if provided (not in index)
    if (filters.roleId) {
      query = query.filter((q) => q.eq(q.field("roleId"), filters.roleId!));
    }

    // Apply global search filter if provided
    if (globalSearch && globalSearch.trim()) {
      const searchLower = globalSearch.toLowerCase().trim();
      query = query.filter((q) => {
        const user = q as any;
        return (
          user.name?.toLowerCase().includes(searchLower) ||
          user.email?.toLowerCase().includes(searchLower)
        );
      });
    }

    // Get paginated results
    const result = await query.paginate(paginationOpts);

    // Batch fetch all unique roles for enrichment
    const uniqueRoleIds = [...new Set(result.page.map((u) => u.roleId))];
    const roles = await Promise.all(uniqueRoleIds.map((id) => ctx.db.get(id)));

    // Create role lookup map for O(1) access
    const roleMap = new Map(
      roles.filter((r): r is NonNullable<typeof r> => r !== null).map((r) => [r._id, r])
    );

    // Enrich users with roleName
    const enrichedUsers = result.page.map((user) => ({
      ...user,
      roleName: roleMap.get(user.roleId)?.name,
    }));

    return {
      ...result,
      page: enrichedUsers,
    };
  },
});

/**
 * Get a single user - supports both direct ID lookup and filter-based queries.
 *
 * @example
 * // Get by ID
 * await ctx.runQuery(api.users.crud.get, { id: "..." })
 *
 * @example
 * // Get user by Clerk ID
 * await ctx.runQuery(api.users.crud.get, { clerkId: "..." })
 */
export const get = query({
  args: {
    id: v.optional(v.id("users")),
    clerkId: v.optional(v.string()),
    email: v.optional(v.string()),
    status: v.optional(statusValidator),
    roleId: v.optional(v.id("roles")),
  },
  handler: async (ctx, args) => {
    const identity = await isAuthenticated(ctx);

    // Direct ID lookup mode
    if (args.id) {
      const user = await ctx.db.get(args.id);
      if (user) {
        await isValidTenant(identity.tenantId, user.tenantId);
      }
      return user;
    }

    // Filter-based mode - use progressive query builder
    const { id, ...filters } = args;
    let query = buildProgressiveQuery(ctx, identity.tenantId, filters);

    // Apply additional filter for roleId if provided (not in index)
    if (filters.roleId) {
      query = query.filter((q) => q.eq(q.field("roleId"), filters.roleId!));
    }

    // Always get newest record when using filters
    return await query.order("desc").first();
  },
});

/**
 * Update a user by ID.
 *
 * @example
 * await ctx.runMutation(api.users.crud.update, {
 *   id: "...",
 *   updates: { name: "New Name", status: "active" }
 * })
 */
export const update = mutation({
  args: {
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
    const identity = await isAuthenticated(ctx);
    const user = await ctx.db.get(args.id);

    if (!user) {
      throw new Error("User not found");
    }

    await isValidTenant(identity.tenantId, user.tenantId);

    // Update with automatic timestamp
    await ctx.db.patch(args.id, {
      ...args.updates,
      updatedAt: Date.now(),
    });

    return await ctx.db.get(args.id);
  },
});

/**
 * Delete a user by ID (soft delete using deletedAt).
 *
 * @example
 * await ctx.runMutation(api.users.crud.delete, { id: "..." })
 */
export const deleteUser = mutation({
  args: {
    id: v.id("users"),
    hard: v.optional(v.boolean()), // true for hard delete, false/undefined for soft delete
  },
  handler: async (ctx, args) => {
    const identity = await isAuthenticated(ctx);
    const user = await ctx.db.get(args.id);

    if (!user) {
      throw new Error("User not found");
    }

    await isValidTenant(identity.tenantId, user.tenantId);

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
