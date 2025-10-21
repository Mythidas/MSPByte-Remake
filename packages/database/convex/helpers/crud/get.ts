import { v } from "convex/values";
import { DataModel, Id } from "../../_generated/dataModel.js";
import { query } from "../../_generated/server.js";
import { isAuthenticated, isValidSecret } from "../validators.js";
import { evaluateFilter, TableName, GetResult, GetArgs } from "./types.js";
import { filter } from "convex-helpers/server/filter";

/**
 * Universal get query that works with ANY table
 * Can fetch by ID or use index + filters to find a single record
 *
 * @param tableName - Name of the table to query
 * @param id - Optional document ID for direct lookup
 * @param index - Optional index configuration for optimized queries
 * @param filters - Optional filter conditions (type-safe based on tableName)
 * @param includeSoftDeleted - Whether to include soft-deleted records (default: false)
 * @returns Single document matching the query, or null if not found (type-safe based on tableName)
 *
 * @example
 * const site = await get({ tableName: 'sites', id: siteId });
 * // site is typed as Doc<'sites'> | null
 *
 * @example
 * const agent = await get({
 *   tableName: 'agents',
 *   index: { name: 'by_guid', params: { guid: 'abc-123' } },
 *   filters: { status: 'online' }
 * });
 * // agent is typed as Doc<'agents'> | null
 */
export const get = query({
  args: {
    tableName: TableName,
    id: v.optional(v.string()),
    index: v.optional(
      v.object({
        name: v.string(),
        params: v.object({}), // Any object shape for index params
      })
    ),
    filters: v.optional(v.object({})), // Any object shape for filters
    includeSoftDeleted: v.optional(v.boolean()),
  },
  handler: async <T extends keyof DataModel>(
    ctx: any,
    args: GetArgs<T>
  ): Promise<GetResult<T>> => {
    const identity = await isAuthenticated(ctx);

    // Direct ID lookup
    if (args.id) {
      const record = await ctx.db.get(args.id as Id<T>);
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
    } = args;

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

    const result = await filter(queryBuilder, (record: any) => {
      if (!includeSoftDeleted && record.deletedAt) {
        return false;
      }

      return evaluateFilter(record, filters);
    }).first();

    return result ?? null;
  },
});

/**
 * _s get function (no auth required, uses secret validation)
 *
 * @example
 * const site = await get_s({
 *   tableName: 'sites',
 *   id: siteId,
 *   secret: process.env.CONVEX_API_KEY
 * });
 * // site is typed as Doc<'sites'> | null
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
        params: v.object({}),
      })
    ),
    filters: v.optional(v.object({})),
    includeSoftDeleted: v.optional(v.boolean()),
  },
  handler: async <T extends keyof DataModel>(
    ctx: any,
    args: GetArgs<T> & { secret: string; tenantId?: Id<"tenants"> }
  ): Promise<GetResult<T>> => {
    await isValidSecret(args.secret);

    // Direct ID lookup
    if (args.id) {
      const record = await ctx.db.get(args.id as Id<T>);
      return record ?? null;
    }

    // Query-based lookup
    const {
      tableName,
      index,
      filters,
      includeSoftDeleted = false,
      tenantId,
    } = args;

    let queryBuilder: any;

    if (index) {
      queryBuilder = ctx.db
        .query(tableName)
        .withIndex(index.name as any, (q: any) => {
          let filtered = q;
          for (const [field, value] of Object.entries(index.params)) {
            filtered = filtered.eq(field, value);
          }
          if (tenantId) filtered = filtered.eq("tenantId", tenantId);
          return filtered;
        });
    } else if (tenantId) {
      queryBuilder = ctx.db
        .query(tableName)
        .withIndex("by_tenant" as any, (q: any) =>
          q.eq("tenantId", tenantId)
        );
    } else {
      queryBuilder = ctx.db.query(tableName);
    }

    const result = await filter(queryBuilder, (record: any) => {
      if (!includeSoftDeleted && record.deletedAt) {
        return false;
      }

      return evaluateFilter(record, filters);
    }).first();

    return result ?? null;
  },
});
