import { v } from "convex/values";
import { DataModel, Id } from "../../_generated/dataModel.js";
import { mutation } from "../../_generated/server.js";
import { isAuthenticated, isValidSecret } from "../validators.js";
import { RemoveResult } from "./types.js";

type DynamicDeleteArgs<TableName extends keyof DataModel> = {
  tableName: TableName;
  ids: Id<TableName> | Id<TableName>[];
  hard?: boolean;
};

/**
 * Universal delete mutation that works with ANY table
 * Supports both single record and batch deletes
 * Supports soft delete (default, sets deletedAt) or hard delete
 *
 * @param tableName - Name of the table to delete from
 * @param ids - Single ID or array of IDs to delete
 * @param hard - If true, permanently delete. Otherwise soft delete (default)
 * @returns Array of deleted IDs
 * @throws Error if any deletion fails (atomic transaction - all or nothing)
 */
export const remove = mutation({
  args: {
    tableName: v.string(),
    ids: v.any(),
    hard: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<RemoveResult<keyof DataModel>> => {
    const identity = await isAuthenticated(ctx);
    const {
      tableName,
      ids,
      hard = false,
    } = args as DynamicDeleteArgs<keyof DataModel>;
    const now = Date.now();

    // Normalize to array for consistent processing
    const idsArray = Array.isArray(ids) ? ids : [ids];

    if (idsArray.length === 0) {
      throw new Error("Remove failed: ids must be a non-empty array or a single ID");
    }

    try {
      // Handle batch delete atomically
      await Promise.all(
        idsArray.map(async (id, index) => {
          try {
            const record = await ctx.db.get(id);

            if (!record) {
              throw new Error(
                `Record not found with id "${id}"`
              );
            }

            if ((record as any).tenantId !== identity.tenantId) {
              throw new Error("Access denied - tenant mismatch");
            }

            if (hard) {
              await ctx.db.delete(id);
            } else {
              await ctx.db.patch(id, {
                deletedAt: now,
                updatedAt: now,
              } as any);
            }
          } catch (error) {
            throw new Error(
              `Delete failed at index ${index} in table "${String(tableName)}" (id: ${id}): ${
                error instanceof Error ? error.message : String(error)
              }`
            );
          }
        })
      );

      return idsArray as Id<typeof tableName>[];
    } catch (error) {
      // Re-throw with context about the batch operation
      throw new Error(
        `Batch ${hard ? "hard" : "soft"} delete failed for table "${String(tableName)}" (attempted ${idsArray.length} records): ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  },
});

/**
 * _s delete function (no auth required, uses secret validation)
 */
export const remove_s = mutation({
  args: {
    tableName: v.string(),
    ids: v.any(),
    tenantId: v.id("tenants"),
    hard: v.optional(v.boolean()),
    secret: v.string(),
  },
  handler: async (ctx, args): Promise<RemoveResult<keyof DataModel>> => {
    await isValidSecret(args.secret);
    const {
      tableName,
      ids,
      tenantId,
      hard = false,
    } = args as DynamicDeleteArgs<keyof DataModel> & {
      tenantId: Id<"tenants">;
      secret: string;
    };
    const now = Date.now();

    // Normalize to array for consistent processing
    const idsArray = Array.isArray(ids) ? ids : [ids];

    if (idsArray.length === 0) {
      throw new Error("Remove failed: ids must be a non-empty array or a single ID");
    }

    try {
      // Handle batch delete atomically
      await Promise.all(
        idsArray.map(async (id, index) => {
          try {
            const record = await ctx.db.get(id);

            if (!record) {
              throw new Error(
                `Record not found with id "${id}"`
              );
            }

            if ((record as any).tenantId !== tenantId) {
              throw new Error("Access denied - tenant mismatch");
            }

            if (hard) {
              await ctx.db.delete(id);
            } else {
              await ctx.db.patch(id, {
                deletedAt: now,
                updatedAt: now,
              } as any);
            }
          } catch (error) {
            throw new Error(
              `Delete failed at index ${index} in table "${String(tableName)}" (id: ${id}): ${
                error instanceof Error ? error.message : String(error)
              }`
            );
          }
        })
      );

      return idsArray as Id<typeof tableName>[];
    } catch (error) {
      // Re-throw with context about the batch operation
      throw new Error(
        `Batch ${hard ? "hard" : "soft"} delete failed for table "${String(tableName)}" (attempted ${idsArray.length} records): ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  },
});
