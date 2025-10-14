import { v, type Validator } from "convex/values";
import { query, mutation, QueryCtx } from "../_generated/server.js";
import { isAuthenticated, isValidSecret } from "./validators.js";
import type { DataModel, Doc, Id } from "../_generated/dataModel.js";

/**
 * Factory for creating standard CRUD operations with minimal boilerplate.
 * Generates both authenticated (for user requests) and internal (for server/API) functions.
 *
 * Features:
 * - Automatic tenant scoping
 * - Timestamp management (_creationTime, updatedAt)
 * - Soft delete support (deletedAt)
 * - Efficient index selection based on filters
 * - Type-safe validators
 * - Both query/mutation and internal function variants
 *
 * @example
 * const agentsCrud = createCrudOperations({
 *   tableName: "agents",
 *   createValidator: v.object({
 *     hostname: v.string(),
 *     guid: v.string(),
 *     siteId: v.id("sites"),
 *     ...
 *   }),
 *   updateValidator: v.object({
 *     hostname: v.optional(v.string()),
 *     ...
 *   }),
 *   filtersValidator: v.object({
 *     siteId: v.optional(v.id("sites")),
 *     guid: v.optional(v.string()),
 *   }),
 *   indexMap: {
 *     siteId: "by_site_ordered",
 *     guid: "by_guid"
 *   }
 * });
 *
 * export const list = agentsCrud.list;
 * export const get = agentsCrud.get;
 */
export function createCrudOperations<
  TableName extends keyof DataModel,
  CreateFields extends Record<string, any>,
  UpdateFields extends Record<string, any>,
  FilterFields extends Record<string, any>,
  GetFields extends Record<string, any>,
>(config: {
  tableName: TableName;
  createValidator: Validator<CreateFields, any, any>;
  updateValidator: Validator<UpdateFields, any, any>;
  filtersValidator: Validator<FilterFields, any, any>;
  getFiltersValidator: Validator<GetFields, any, any>;
  softDelete?: boolean;
}) {
  const {
    tableName,
    createValidator,
    updateValidator,
    filtersValidator,
    getFiltersValidator,
    softDelete = true,
  } = config;

  // ============================================================================
  // LIST OPERATIONS
  // ============================================================================

  /**
   * List all records for the authenticated tenant.
   * Uses indexMap for efficient filtering, otherwise returns ALL records.
   * Client-side filtering handles complex queries.
   */
  const list = query({
    args: v.object({
      filter: v.optional(filtersValidator),
    }),
    handler: async (ctx, args): Promise<Doc<typeof tableName>[]> => {
      const identity = await isAuthenticated(ctx);
      let query: any;

      if (args.filter) {
        for (const [filterKey, filterValue] of Object.entries(args.filter)) {
          if (!filterValue) continue;
          const entries = Object.entries(filterValue);

          if (!entries.length) continue;

          query = ctx.db.query(tableName).withIndex(filterKey, (q) => {
            let filtered = q as any;
            for (const [field, val] of entries) {
              filtered = filtered.eq(field as any, val as any);
            }

            filtered = filtered.eq("tenantId", identity.tenantId);
            return filtered;
          });
        }
      }

      if (!query) {
        query = ctx.db
          .query(tableName)
          .withIndex("by_tenant", (q: any) =>
            q.eq("tenantId", identity.tenantId)
          );
      }

      if (softDelete) {
        query = query.filter((q: any) => q.eq(q.field("deletedAt"), undefined));
      }

      return await query.collect();
    },
  });

  /**
   * _s list function (no auth required).
   */
  const list_s = query({
    args: {
      filter: v.optional(filtersValidator),
      secret: v.string(),
    },
    handler: async (ctx, args): Promise<Doc<typeof tableName>[]> => {
      await isValidSecret(args.secret);
      let query: any;

      // Check if we have ONE filter that maps to an index
      if (args.filter) {
        for (const [filterKey, filterValue] of Object.entries(args.filter)) {
          if (!filterValue) continue;
          const entries = Object.entries(filterValue);

          if (!entries.length) continue;

          query = ctx.db.query(tableName).withIndex(filterKey, (q) => {
            let filtered = q as any;
            for (const [field, val] of entries) {
              filtered = filtered.eq(field as any, val as any);
            }

            return filtered;
          });
        }
      }

      // Fallback: return ALL tenant records
      if (!query) {
        query = ctx.db.query(tableName).order("desc");
      }

      // Filter soft-deleted
      if (softDelete) {
        query = query.filter((q: any) => q.eq(q.field("deletedAt"), undefined));
      }

      return await query.collect();
    },
  });

  // ============================================================================
  // GET OPERATIONS
  // ============================================================================

  const getRecord = async (
    ctx: QueryCtx,
    args: {
      id?: Id<TableName> | undefined;
      tenantId?: Id<"tenants">;
      filters?: Exclude<GetFields, undefined> | undefined;
    }
  ): Promise<Doc<typeof tableName> | null> => {
    if (args.id) {
      return await ctx.db.get(args.id);
    }

    let query: any;

    // Check if we have ONE filter that maps to an index
    if (args.filters) {
      for (const [filterKey, filterValue] of Object.entries(args.filters)) {
        if (!filterValue) continue;
        const entries = Object.entries(filterValue);

        if (!entries.length) continue;

        query = ctx.db.query(tableName).withIndex(filterKey, (q) => {
          let filtered = q as any;
          for (const [field, val] of entries) {
            filtered = filtered.eq(field as any, val as any);
          }

          if (args.tenantId) filtered = filtered.eq("tenantId", args.tenantId);
          return filtered;
        });
      }
    }

    // Fallback: return ALL tenant records
    if (!query) {
      return null;
    }

    return await query.unique();
  };

  /**
   * Get a single record by ID only.
   */
  const get = query({
    args: {
      id: v.optional(v.id(tableName)),
      filters: v.optional(getFiltersValidator),
    },
    handler: async (ctx, args) => {
      const identity = await isAuthenticated(ctx);

      const record = await getRecord(ctx, {
        ...args,
        tenantId: identity.tenantId,
      });

      if (!record) return null;

      // Verify tenant access
      if ((record as any).tenantId !== identity.tenantId) {
        throw new Error("Access denied");
      }

      // Check if soft-deleted
      if (softDelete && (record as any).deletedAt) {
        return null;
      }

      return record;
    },
  });

  /**
   * _s get function (no auth required).
   */
  const get_s = query({
    args: {
      id: v.optional(v.id(tableName)),
      tenantId: v.optional(v.id("tenants")),
      filters: v.optional(getFiltersValidator),
      secret: v.string(),
    },
    handler: async (ctx, args) => {
      await isValidSecret(args.secret);
      const record = await getRecord(ctx, args);

      if (!record) return null;

      // Check if soft-deleted
      if (softDelete && (record as any).deletedAt) {
        return null;
      }

      return record;
    },
  });

  // ============================================================================
  // CREATE OPERATIONS
  // ============================================================================

  const create = mutation({
    args: {
      data: createValidator,
    },
    handler: async (ctx, args) => {
      const identity = await isAuthenticated(ctx);
      const now = Date.now();

      const id = await ctx.db.insert(tableName, {
        ...args.data,
        tenantId: identity.tenantId,
        updatedAt: now,
      } as any);

      return await ctx.db.get(id);
    },
  });

  const create_s = mutation({
    args: {
      data: createValidator,
      tenantId: v.id("tenants"),
      secret: v.string(),
    },
    handler: async (ctx, args) => {
      await isValidSecret(args.secret);
      const now = Date.now();

      const id = await ctx.db.insert(tableName, {
        ...args.data,
        tenantId: args.tenantId,
        updatedAt: now,
      } as any);

      return await ctx.db.get(id);
    },
  });

  // ============================================================================
  // UPDATE OPERATIONS
  // ============================================================================

  const update = mutation({
    args: {
      id: v.id(tableName),
      updates: updateValidator,
    },
    handler: async (ctx, args) => {
      const identity = await isAuthenticated(ctx);
      const record = await ctx.db.get(args.id);

      if (!record) {
        throw new Error(`${String(tableName)} not found`);
      }

      if ((record as any).tenantId !== identity.tenantId) {
        throw new Error("Access denied");
      }

      await ctx.db.patch(args.id, {
        ...args.updates,
        updatedAt: Date.now(),
      } as any);

      return await ctx.db.get(args.id);
    },
  });

  const update_s = mutation({
    args: {
      id: v.id(tableName),
      updates: updateValidator,
      secret: v.string(),
    },
    handler: async (ctx, args) => {
      await isValidSecret(args.secret);
      const record = await ctx.db.get(args.id);

      if (!record) {
        throw new Error(`${String(tableName)} not found`);
      }

      await ctx.db.patch(args.id, {
        ...args.updates,
        updatedAt: Date.now(),
      } as any);

      return await ctx.db.get(args.id);
    },
  });

  // ============================================================================
  // DELETE OPERATIONS
  // ============================================================================

  const deleteRecord = mutation({
    args: {
      id: v.id(tableName),
      hard: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
      const identity = await isAuthenticated(ctx);
      const record = await ctx.db.get(args.id);

      if (!record) {
        throw new Error(`${String(tableName)} not found`);
      }

      if ((record as any).tenantId !== identity.tenantId) {
        throw new Error("Access denied");
      }

      if (args.hard || !softDelete) {
        await ctx.db.delete(args.id);
      } else {
        await ctx.db.patch(args.id, {
          deletedAt: Date.now(),
          updatedAt: Date.now(),
        } as any);
      }

      return true;
    },
  });

  const delete_s = mutation({
    args: {
      id: v.id(tableName),
      hard: v.optional(v.boolean()),
      secret: v.string(),
    },
    handler: async (ctx, args) => {
      await isValidSecret(args.secret);
      const record = await ctx.db.get(args.id);

      if (!record) {
        throw new Error(`${String(tableName)} not found`);
      }

      if (args.hard || !softDelete) {
        await ctx.db.delete(args.id);
      } else {
        await ctx.db.patch(args.id, {
          deletedAt: Date.now(),
          updatedAt: Date.now(),
        } as any);
      }

      return true;
    },
  });

  return {
    // Authenticated operations
    list,
    get,
    create,
    update,
    delete: deleteRecord,

    // _s operations
    list_s,
    get_s,
    create_s,
    update_s,
    delete_s,
  };
}
