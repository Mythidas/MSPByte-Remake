import { v } from "convex/values";
import { DataModel, Doc, Id } from "../../_generated/dataModel.js";
import { mutation } from "../../_generated/server.js";
import { isAuthenticated, isValidSecret } from "../validators.js";
import { InsertResult, InsertArgs, TableName } from "./types.js";

/**
 * Universal insert mutation that works with ANY table
 * Supports both single record and batch inserts
 *
 * @param tableName - Name of the table to insert into
 * @param data - Array of records to insert
 * @returns Array of IDs for successfully created records (type-safe based on tableName)
 * @throws Error if any insertion fails (atomic transaction - all or nothing)
 *
 * @example
 * const siteIds = await insert({ tableName: 'sites', data: [{name: 'Acme Corp'}] });
 * // siteIds is typed as Id<'sites'>[]
 */
export const insert = mutation({
  args: {
    tableName: TableName,
    data: v.array(v.object({})), // Any object shape, but enforces structure
  },
  handler: async <T extends keyof DataModel>(
    ctx: any,
    args: InsertArgs<T>
  ): Promise<InsertResult<T>> => {
    const identity = await isAuthenticated(ctx);
    const { tableName, data } = args;
    const now = Date.now();

    if (!Array.isArray(data) || data.length === 0) {
      throw new Error("Insert failed: data must be a non-empty array");
    }

    try {
      // Handle batch insert atomically
      const ids = await Promise.all(
        data.map(async (record, index) => {
          try {
            const insertData = {
              ...record,
              tenantId: identity.tenantId,
              updatedAt: now,
            };

            const id = await ctx.db.insert(tableName, insertData as any);
            return id as Id<T>;
          } catch (error) {
            throw new Error(
              `Insert failed at index ${index} in table "${String(tableName)}": ${
                error instanceof Error ? error.message : String(error)
              }`
            );
          }
        })
      );

      return ids;
    } catch (error) {
      // Re-throw with context about the batch operation
      throw new Error(
        `Batch insert failed for table "${String(tableName)}" (attempted ${data.length} records): ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  },
});

/**
 * _s insert function (no auth required, uses secret validation)
 *
 * @example
 * const siteIds = await insert_s({
 *   tableName: 'sites',
 *   data: [{name: 'Acme Corp'}],
 *   tenantId: 'k1abc123',
 *   secret: process.env.CONVEX_API_KEY
 * });
 * // siteIds is typed as Id<'sites'>[]
 */
export const insert_s = mutation({
  args: {
    tableName: TableName,
    data: v.array(v.object({})),
    tenantId: v.id("tenants"),
    secret: v.string(),
  },
  handler: async <T extends keyof DataModel>(
    ctx: any,
    args: InsertArgs<T> & { tenantId: Id<"tenants">; secret: string }
  ): Promise<InsertResult<T>> => {
    await isValidSecret(args.secret);
    const { tableName, data, tenantId } = args;
    const now = Date.now();

    try {
      // Handle batch insert atomically
      const ids = await Promise.all(
        data.map(async (record, index) => {
          try {
            const insertData = {
              ...record,
              tenantId,
              updatedAt: now,
            };

            const id = await ctx.db.insert(tableName, insertData as any);
            return id as Id<T>;
          } catch (error) {
            throw new Error(
              `Insert failed at index ${index} in table "${String(tableName)}": ${
                error instanceof Error ? error.message : String(error)
              }`
            );
          }
        })
      );

      return ids;
    } catch (error) {
      // Re-throw with context about the batch operation
      throw new Error(
        `Batch insert failed for table "${String(tableName)}" (attempted ${data.length} records): ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  },
});
