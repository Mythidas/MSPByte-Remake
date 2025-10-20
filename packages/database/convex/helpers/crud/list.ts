import { v } from "convex/values";
import { DataModel } from "../../_generated/dataModel.js";
import { query } from "../../_generated/server.js";
import { isAuthenticated, isValidSecret } from "../validators.js";
import { DynamicListArgs, evaluateFilter, TableName, ListResult } from "./types.js";
import { filter } from "convex-helpers/server/filter";

/**
 * Universal list query that works with ANY table
 *
 * @param tableName - Name of the table to query
 * @param index - Optional index configuration for optimized queries
 * @param filters - Optional filter conditions
 * @param includeSoftDeleted - Whether to include soft-deleted records (default: false)
 * @returns Array of documents matching the query
 */
export const list = query({
  args: {
    tableName: TableName,
    index: v.optional(
      v.object({
        name: v.string(),
        params: v.any(),
      })
    ),
    filters: v.optional(v.any()),
    includeSoftDeleted: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<ListResult<keyof DataModel>> => {
    const identity = await isAuthenticated(ctx);
    const {
      tableName,
      index,
      filters,
      includeSoftDeleted = false,
    } = args as DynamicListArgs<keyof DataModel>;

    // Step 1: Start with index query
    let queryBuilder: any;

    if (index) {
      // Use custom index with provided params + tenantId
      queryBuilder = ctx.db
        .query(tableName)
        .withIndex(index.name as any, (q: any) => {
          let filtered = q;

          // Apply index params in order
          for (const [field, value] of Object.entries(index.params)) {
            filtered = filtered.eq(field, value);
          }

          // Always add tenantId for tenant isolation
          filtered = filtered.eq("tenantId", identity.tenantId);

          return filtered;
        });
    } else {
      // Default to by_tenant index
      queryBuilder = ctx.db
        .query(tableName)
        .withIndex("by_tenant" as any, (q: any) =>
          q.eq("tenantId", identity.tenantId)
        );
    }

    // Step 2: Apply filters and collect results
    const results = await filter(queryBuilder, (record) => {
      if (!includeSoftDeleted && record.deletedAt) {
        return false;
      }

      return evaluateFilter(record as any, filters);
    }).collect();

    return results;
  },
});

/**
 * _s list function (no auth required, uses secret validation)
 */
export const list_s = query({
  args: {
    tableName: TableName,
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
  handler: async (ctx, args): Promise<ListResult<keyof DataModel>> => {
    await isValidSecret(args.secret);

    const {
      tableName,
      index,
      filters,
      includeSoftDeleted = false,
    } = args as DynamicListArgs<keyof DataModel>;

    // Step 1: Start with index query
    let queryBuilder: any;

    if (index) {
      // Use custom index with provided params + tenantId
      queryBuilder = ctx.db
        .query(tableName)
        .withIndex(index.name as any, (q: any) => {
          let filtered = q;

          // Apply index params in order
          for (const [field, value] of Object.entries(index.params)) {
            filtered = filtered.eq(field, value);
          }

          if (args.tenantId) filtered = filtered.eq("tenantId", args.tenantId);

          return filtered;
        });
    } else if (args.tenantId) {
      // Default to by_tenant index
      queryBuilder = ctx.db
        .query(tableName)
        .withIndex("by_tenant" as any, (q: any) =>
          q.eq("tenantId", args.tenantId)
        );
    } else {
      queryBuilder = ctx.db.query(tableName);
    }

    // Step 2: Apply filters and collect results
    const results = await filter(queryBuilder, (record) => {
      if (!includeSoftDeleted && record.deletedAt) {
        return false;
      }

      return evaluateFilter(record as any, filters);
    }).collect();

    return results;
  },
});
