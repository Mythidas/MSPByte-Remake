import { v } from "convex/values";
import { DataModel, Id } from "../../_generated/dataModel.js";
import { query } from "../../_generated/server.js";
import { isAuthenticated, isValidSecret } from "../validators.js";
import { evaluateFilter, TableName, ListResult, ListArgs } from "./types.js";
import { filter } from "convex-helpers/server/filter";

/**
 * Universal list query that works with ANY table
 *
 * @param tableName - Name of the table to query
 * @param index - Optional index configuration for optimized queries
 * @param filters - Optional filter conditions (type-safe based on tableName)
 * @param includeSoftDeleted - Whether to include soft-deleted records (default: false)
 * @returns Array of documents matching the query (type-safe based on tableName)
 *
 * @example
 * const sites = await list({ tableName: 'sites', filters: { status: 'active' } });
 * // sites is typed as Doc<'sites'>[]
 *
 * @example
 * const agents = await list({
 *   tableName: 'agents',
 *   index: { name: 'by_site', params: { siteId: 'abc123' } },
 *   filters: { status: 'online' }
 * });
 * // agents is typed as Doc<'agents'>[]
 */
export const list = query({
    args: {
        tableName: TableName,
        index: v.optional(
            v.object({
                name: v.string(),
                params: v.any(), // Any object shape for index params
            })
        ),
        filters: v.optional(v.any()), // Any object shape for filters
        includeSoftDeleted: v.optional(v.boolean()),
        limit: v.optional(v.number()),
    },
    handler: async <T extends keyof DataModel>(
        ctx: any,
        args: ListArgs<T>
    ): Promise<ListResult<T>> => {
        const identity = await isAuthenticated(ctx);
        const { tableName, index, filters, includeSoftDeleted = false, limit } = args;

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
        const allResults = await filter(queryBuilder, (record: any) => {
            if (!includeSoftDeleted && record.deletedAt) {
                return false;
            }

            return evaluateFilter(record, filters);
        }).collect();

        // Apply limit if provided
        const results = limit ? allResults.slice(0, limit) : allResults;

        return results;
    },
});

/**
 * _s list function (no auth required, uses secret validation)
 *
 * @example
 * const sites = await list_s({
 *   tableName: 'sites',
 *   tenantId: 'abc123',
 *   secret: process.env.CONVEX_API_KEY
 * });
 * // sites is typed as Doc<'sites'>[]
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
        limit: v.optional(v.number()),
    },
    handler: async <T extends keyof DataModel>(
        ctx: any,
        args: ListArgs<T> & { secret: string; tenantId?: Id<"tenants"> }
    ): Promise<ListResult<T>> => {
        await isValidSecret(args.secret);

        const {
            tableName,
            index,
            filters,
            includeSoftDeleted = false,
            tenantId,
            limit,
        } = args;

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

                    if (tenantId) filtered = filtered.eq("tenantId", tenantId);

                    return filtered;
                });
        } else if (tenantId) {
            // Default to by_tenant index
            queryBuilder = ctx.db
                .query(tableName)
                .withIndex("by_tenant" as any, (q: any) => q.eq("tenantId", tenantId));
        } else {
            queryBuilder = ctx.db.query(tableName);
        }

        // Step 2: Apply filters and collect results
        const allResults = await filter(queryBuilder, (record: any) => {
            if (!includeSoftDeleted && record.deletedAt) {
                return false;
            }

            return evaluateFilter(record, filters);
        }).collect();

        // Apply limit if provided
        const results = limit ? allResults.slice(0, limit) : allResults;

        return results;
    },
});
