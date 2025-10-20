import { v } from "convex/values";
import { DataModel, Doc, Id } from "../../_generated/dataModel.js";
import { mutation } from "../../_generated/server.js";
import { isAuthenticated, isValidSecret } from "../validators.js";
import { InsertResult } from "./types.js";

type DynamicInsertArgs<TableName extends keyof DataModel> = {
  tableName: TableName;
  data: Partial<Doc<TableName>>[];
};

/**
 * Universal insert mutation that works with ANY table
 * Supports both single record and batch inserts
 *
 * @param tableName - Name of the table to insert into
 * @param data - Array of records to insert
 * @returns Array of IDs for successfully created records
 * @throws Error if any insertion fails (atomic transaction - all or nothing)
 */
export const insert = mutation({
  args: {
    tableName: v.string(),
    data: v.any(),
  },
  handler: async (ctx, args): Promise<InsertResult<keyof DataModel>> => {
    const identity = await isAuthenticated(ctx);
    const { tableName, data } = args as DynamicInsertArgs<keyof DataModel>;
    const now = Date.now();

    if (!Array.isArray(data) || data.length === 0) {
      throw new Error("Insert failed: data must be a non-empty array");
    }

    try {
      // Handle batch insert atomically
      const ids = await Promise.all(
        data.map(async (record, index) => {
          try {
            const id = await ctx.db.insert(tableName, {
              ...record,
              tenantId: identity.tenantId,
              updatedAt: now,
            } as any);
            return id as Id<typeof tableName>;
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
 */
export const insert_s = mutation({
  args: {
    tableName: v.string(),
    data: v.any(),
    tenantId: v.id("tenants"),
    secret: v.string(),
  },
  handler: async (ctx, args): Promise<InsertResult<keyof DataModel>> => {
    await isValidSecret(args.secret);
    const { tableName, data, tenantId } = args as DynamicInsertArgs<
      keyof DataModel
    > & { tenantId: Id<"tenants">; secret: string };
    const now = Date.now();

    if (!Array.isArray(data) || data.length === 0) {
      throw new Error("Insert failed: data must be a non-empty array");
    }

    try {
      // Handle batch insert atomically
      const ids = await Promise.all(
        data.map(async (record, index) => {
          try {
            const id = await ctx.db.insert(tableName, {
              ...record,
              tenantId,
              updatedAt: now,
            } as any);
            return id as Id<typeof tableName>;
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
