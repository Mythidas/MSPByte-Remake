import { v } from "convex/values";
import { DataModel } from "../../_generated/dataModel.js";
import { query } from "../../_generated/server.js";
import { isAuthenticated, isValidSecret } from "../validators.js";
import { DynamicListArgs, evaluateFilter, TableName, GetResult } from "./types.js";
import { filter } from "convex-helpers/server/filter";

/**
 * Universal get query that works with ANY table
 * Can fetch by ID or use index + filters to find a single record
 *
 * @param tableName - Name of the table to query
 * @param id - Optional document ID for direct lookup
 * @param index - Optional index configuration for optimized queries
 * @param filters - Optional filter conditions
 * @param includeSoftDeleted - Whether to include soft-deleted records (default: false)
 * @returns Single document matching the query, or null if not found
 */
export const get = query({
  args: {
    tableName: TableName,
    id: v.optional(v.string()),
    index: v.optional(
      v.object({
        name: v.string(),
        params: v.any(),
      })
    ),
    filters: v.optional(v.any()),
    includeSoftDeleted: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<GetResult<keyof DataModel>> => {
    const identity = await isAuthenticated(ctx);

    // Direct ID lookup
    if (args.id) {
      const record = await ctx.db.get(args.id as any);
      if (!record) return null;
      if ((record as any).tenantId === identity.tenantId) return record;
      return null;
    }

    // Query-based lookup
    const {
      tableName,
      index,
      filters,
      includeSoftDeleted = false,
    } = args as DynamicListArgs<keyof DataModel>;

    let queryBuilder: any;

    if (index) {
      queryBuilder = ctx.db
        .query(tableName)
        .withIndex(index.name as any, (q: any) => {
          let filtered = q;
          for (const [field, value] of Object.entries(index.params)) {
            filtered = filtered.eq(field, value);
          }
          filtered = filtered.eq("tenantId", identity.tenantId);
          return filtered;
        });
    } else {
      queryBuilder = ctx.db
        .query(tableName)
        .withIndex("by_tenant" as any, (q: any) =>
          q.eq("tenantId", identity.tenantId)
        );
    }

    const result = await filter(queryBuilder, (record) => {
      if (!includeSoftDeleted && record.deletedAt) {
        return false;
      }

      return evaluateFilter(record as any, filters);
    }).first();

    return result ?? null;
  },
});

/**
 * _s get function (no auth required, uses secret validation)
 */
export const get_s = query({
  args: {
    tableName: TableName,
    id: v.optional(v.string()),
    secret: v.string(),
    tenantId: v.optional(v.id("tenants")),
    index: v.optional(
      v.object({
        name: v.string(),
        params: v.any(),
      })
    ),
    filters: v.optional(v.any()),
    includeSoftDeleted: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<GetResult<keyof DataModel>> => {
    await isValidSecret(args.secret);

    // Direct ID lookup
    if (args.id) {
      const record = await ctx.db.get(args.id as any);
      return record ?? null;
    }

    // Query-based lookup
    const {
      tableName,
      index,
      filters,
      includeSoftDeleted = false,
    } = args as DynamicListArgs<keyof DataModel>;

    let queryBuilder: any;

    if (index) {
      queryBuilder = ctx.db
        .query(tableName)
        .withIndex(index.name as any, (q: any) => {
          let filtered = q;
          for (const [field, value] of Object.entries(index.params)) {
            filtered = filtered.eq(field, value);
          }
          if (args.tenantId) filtered = filtered.eq("tenantId", args.tenantId);
          return filtered;
        });
    } else if (args.tenantId) {
      queryBuilder = ctx.db
        .query(tableName)
        .withIndex("by_tenant" as any, (q: any) =>
          q.eq("tenantId", args.tenantId)
        );
    } else {
      queryBuilder = ctx.db.query(tableName);
    }

    const result = await filter(queryBuilder, (record) => {
      if (!includeSoftDeleted && record.deletedAt) {
        return false;
      }

      return evaluateFilter(record as any, filters);
    }).first();

    return result ?? null;
  },
});
