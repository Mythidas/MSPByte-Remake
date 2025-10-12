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
 * Builds a progressive query for roles based on provided filters.
 * Selects the most efficient index based on which filters are provided.
 * Handles both global roles (tenantId === undefined) and tenant-specific roles.
 */
function buildProgressiveQuery(
  ctx: any,
  tenantId: Id<"tenants"> | undefined,
  filters: {
    name?: string;
  }
): Query<DataModel["roles"]> {
  const { name } = filters;

  // Progressive index selection
  if (name) {
    return ctx.db
      .query("roles")
      .withIndex("by_name", (q: any) => q.eq("name", name));
  } else {
    // Query by tenantId (handles both global and tenant-specific roles)
    return ctx.db
      .query("roles")
      .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenantId));
  }
}

// ============================================================================
// CRUD OPERATIONS
// ============================================================================

/**
 * List roles with optional filtering and ordering.
 *
 * @example
 * // Get all roles for current tenant
 * await ctx.runQuery(api.roles.crud.list, {})
 *
 * @example
 * // Get all global/system roles
 * await ctx.runQuery(api.roles.crud.list, { includeGlobal: true })
 */
export const list = query({
  args: {
    name: v.optional(v.string()),
    includeGlobal: v.optional(v.boolean()), // Include global/system roles
    order: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
  },
  handler: async (ctx, args) => {
    const identity = await isAuthenticated(ctx);
    const { order = "desc", includeGlobal = false, ...filters } = args;

    let roles: any[] = [];

    // Query tenant-specific roles
    if (!includeGlobal) {
      const query = buildProgressiveQuery(ctx, identity.tenantId, filters);
      const orderedQuery: OrderedQuery<DataModel["roles"]> = query.order(order);
      roles = await orderedQuery.collect();
    } else {
      // Query both tenant-specific and global roles
      const tenantQuery = buildProgressiveQuery(ctx, identity.tenantId, filters);
      const tenantOrderedQuery: OrderedQuery<DataModel["roles"]> = tenantQuery.order(order);
      const tenantRoles = await tenantOrderedQuery.collect();

      const globalQuery = buildProgressiveQuery(ctx, undefined, filters);
      const globalOrderedQuery: OrderedQuery<DataModel["roles"]> = globalQuery.order(order);
      const globalRoles = await globalOrderedQuery.collect();

      // Combine and sort
      roles = [...tenantRoles, ...globalRoles].sort((a, b) => {
        return order === "asc" ? a.createdAt - b.createdAt : b.createdAt - a.createdAt;
      });
    }

    return roles;
  },
});

/**
 * Paginate roles with cursor-based pagination, global search, and sorting.
 *
 * @example
 * await ctx.runQuery(api.roles.crud.paginate, {
 *   paginationOpts: { numItems: 50, cursor: null },
 *   globalSearch: "admin"
 * })
 */
export const paginate = query({
  args: {
    name: v.optional(v.string()),
    includeGlobal: v.optional(v.boolean()),
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
      includeGlobal = false,
      ...filters
    } = args;

    // Build progressive query (tenant-specific by default)
    let indexedQuery = buildProgressiveQuery(ctx, identity.tenantId, filters);

    // Apply ordering (use sortDirection if sortColumn is provided, otherwise use order)
    let query: OrderedQuery<DataModel["roles"]> = indexedQuery;
    const orderDirection = sortColumn && sortDirection ? sortDirection : order;
    query = indexedQuery.order(orderDirection);

    // Apply global search filter if provided
    if (globalSearch && globalSearch.trim()) {
      const searchLower = globalSearch.toLowerCase().trim();
      query = query.filter((q) => {
        const role = q as any;
        return (
          role.name?.toLowerCase().includes(searchLower) ||
          role.description?.toLowerCase().includes(searchLower)
        );
      });
    }

    // Get paginated tenant-specific roles
    const paginatedResult = await query.paginate(paginationOpts);

    // Include global roles if requested (only on first page, when cursor is null)
    if (includeGlobal && paginationOpts.cursor === null) {
      // Query all global roles (at most ~10, so no pagination needed)
      let globalQuery = buildProgressiveQuery(ctx, undefined, filters);
      let globalOrderedQuery: OrderedQuery<DataModel["roles"]> = globalQuery.order(orderDirection);

      // Apply same global search filter to global roles
      if (globalSearch && globalSearch.trim()) {
        const searchLower = globalSearch.toLowerCase().trim();
        globalOrderedQuery = globalOrderedQuery.filter((q) => {
          const role = q as any;
          return (
            role.name?.toLowerCase().includes(searchLower) ||
            role.description?.toLowerCase().includes(searchLower)
          );
        });
      }

      const globalRoles = await globalOrderedQuery.collect();

      // Inject global roles at the beginning of the first page
      return {
        ...paginatedResult,
        page: [...globalRoles, ...paginatedResult.page],
      };
    }

    // Return paginated results
    return paginatedResult;
  },
});

/**
 * Get a single role - supports both direct ID lookup and filter-based queries.
 *
 * @example
 * // Get by ID
 * await ctx.runQuery(api.roles.crud.get, { id: "..." })
 *
 * @example
 * // Get role by name
 * await ctx.runQuery(api.roles.crud.get, { name: "Admin" })
 */
export const get = query({
  args: {
    id: v.optional(v.id("roles")),
    name: v.optional(v.string()),
    includeGlobal: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await isAuthenticated(ctx);

    // Direct ID lookup mode
    if (args.id) {
      const role = await ctx.db.get(args.id);
      if (role && role.tenantId) {
        await isValidTenant(identity.tenantId, role.tenantId);
      }
      return role;
    }

    // Filter-based mode - use progressive query builder
    const { id, includeGlobal = false, ...filters } = args;

    // Try tenant-specific first
    let query = buildProgressiveQuery(ctx, identity.tenantId, filters);
    let role = await query.order("desc").first();

    // If not found and includeGlobal is true, try global roles
    if (!role && includeGlobal) {
      const globalQuery = buildProgressiveQuery(ctx, undefined, filters);
      role = await globalQuery.order("desc").first();
    }

    return role;
  },
});

/**
 * Create a new role.
 *
 * @example
 * await ctx.runMutation(api.roles.crud.create, {
 *   name: "Custom Admin",
 *   description: "Custom administrator role",
 *   rights: { canManageUsers: true, canManageSites: true }
 * })
 */
export const create = mutation({
  args: {
    name: v.string(),
    description: v.string(),
    rights: v.any(),
    isGlobal: v.optional(v.boolean()), // Create as global role (admin only)
  },
  handler: async (ctx, args) => {
    const identity = await isAuthenticated(ctx);
    const { isGlobal = false, ...roleData } = args;

    // Check if role with same name already exists
    const existingRole = await ctx.db
      .query("roles")
      .withIndex("by_name", (q) => q.eq("name", roleData.name))
      .first();

    if (existingRole) {
      throw new Error(`Role with name "${roleData.name}" already exists`);
    }

    const now = Date.now();
    const newRole = {
      ...roleData,
      tenantId: isGlobal ? undefined : identity.tenantId,
      createdAt: now,
      updatedAt: now,
    };

    const roleId = await ctx.db.insert("roles", newRole);
    return await ctx.db.get(roleId);
  },
});

/**
 * Update a role by ID.
 *
 * @example
 * await ctx.runMutation(api.roles.crud.update, {
 *   id: "...",
 *   updates: { description: "Updated description", rights: {...} }
 * })
 */
export const update = mutation({
  args: {
    id: v.id("roles"),
    updates: v.object({
      name: v.optional(v.string()),
      description: v.optional(v.string()),
      rights: v.optional(v.any()),
    }),
  },
  handler: async (ctx, args) => {
    const identity = await isAuthenticated(ctx);
    const role = await ctx.db.get(args.id);

    if (!role) {
      throw new Error("Role not found");
    }

    // Only allow updating tenant-specific roles (not global roles)
    if (!role.tenantId) {
      throw new Error("Cannot update global/system roles");
    }

    await isValidTenant(identity.tenantId, role.tenantId);

    // If updating name, check for duplicates
    if (args.updates.name && args.updates.name !== role.name) {
      const existingRole = await ctx.db
        .query("roles")
        .withIndex("by_name", (q) => q.eq("name", args.updates.name!))
        .first();

      if (existingRole && existingRole._id !== args.id) {
        throw new Error(`Role with name "${args.updates.name}" already exists`);
      }
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
 * Delete a role by ID (soft delete using deletedAt).
 *
 * @example
 * // Soft delete
 * await ctx.runMutation(api.roles.crud.deleteRole, { id: "..." })
 *
 * @example
 * // Hard delete
 * await ctx.runMutation(api.roles.crud.deleteRole, { id: "...", hard: true })
 */
export const deleteRole = mutation({
  args: {
    id: v.id("roles"),
    hard: v.optional(v.boolean()), // true for hard delete, false/undefined for soft delete
  },
  handler: async (ctx, args) => {
    const identity = await isAuthenticated(ctx);
    const role = await ctx.db.get(args.id);

    if (!role) {
      throw new Error("Role not found");
    }

    // Only allow deleting tenant-specific roles (not global roles)
    if (!role.tenantId) {
      throw new Error("Cannot delete global/system roles");
    }

    await isValidTenant(identity.tenantId, role.tenantId);

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
