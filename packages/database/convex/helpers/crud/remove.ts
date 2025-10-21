import { v } from "convex/values";
import { DataModel, Id } from "../../_generated/dataModel.js";
import { mutation } from "../../_generated/server.js";
import { isAuthenticated, isValidSecret } from "../validators.js";
import { RemoveResult, RemoveArgs, TableName } from "./types.js";

/**
 * Universal delete mutation that works with ANY table
 * Supports both single record and batch deletes
 * Supports soft delete (default, sets deletedAt) or hard delete
 *
 * @param tableName - Name of the table to delete from
 * @param ids - Single ID or array of IDs to delete (type-safe based on tableName)
 * @param hard - If true, permanently delete. Otherwise soft delete (default)
 * @returns Array of deleted IDs (type-safe based on tableName)
 * @throws Error if any deletion fails (atomic transaction - all or nothing)
 *
 * @example
 * const deletedIds = await remove({
 *   tableName: 'sites',
 *   ids: siteId, // or [siteId1, siteId2]
 *   hard: false
 * });
 * // deletedIds is typed as Id<'sites'>[]
 */
export const remove = mutation({
  args: {
    tableName: TableName,
    ids: v.union(v.string(), v.array(v.string())), // Single ID or array of IDs
    hard: v.optional(v.boolean()),
  },
  handler: async <T extends keyof DataModel>(
    ctx: any,
    args: RemoveArgs<T>
  ): Promise<RemoveResult<T>> => {
    const identity = await isAuthenticated(ctx);
    const {
      tableName,
      ids,
      hard = false,
    } = args;
    const now = Date.now();

    // Normalize to array for consistent processing
    const idsArray = (Array.isArray(ids) ? ids : [ids]) as Id<T>[];

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
              const patchData = {
                deletedAt: now,
                updatedAt: now,
              };
              await ctx.db.patch(id, patchData as any);
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

      return idsArray;
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
 *
 * @example
 * const deletedIds = await remove_s({
 *   tableName: 'sites',
 *   ids: siteId,
 *   tenantId: 'abc123',
 *   secret: process.env.CONVEX_API_KEY
 * });
 * // deletedIds is typed as Id<'sites'>[]
 */
export const remove_s = mutation({
  args: {
    tableName: TableName,
    ids: v.union(v.string(), v.array(v.string())),
    tenantId: v.id("tenants"),
    hard: v.optional(v.boolean()),
    secret: v.string(),
  },
  handler: async <T extends keyof DataModel>(
    ctx: any,
    args: RemoveArgs<T> & { tenantId: Id<"tenants">; secret: string }
  ): Promise<RemoveResult<T>> => {
    await isValidSecret(args.secret);
    const {
      tableName,
      ids,
      tenantId,
      hard = false,
    } = args;
    const now = Date.now();

    // Normalize to array for consistent processing
    const idsArray = (Array.isArray(ids) ? ids : [ids]) as Id<T>[];

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
              const patchData = {
                deletedAt: now,
                updatedAt: now,
              };
              await ctx.db.patch(id, patchData as any);
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

      return idsArray;
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
