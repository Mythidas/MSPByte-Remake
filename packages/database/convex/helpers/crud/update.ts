import { v } from "convex/values";
import { DataModel, Id, Doc } from "../../_generated/dataModel.js";
import { mutation } from "../../_generated/server.js";
import { cleanUpdates } from "../shortcuts.js";
import { isAuthenticated, isValidSecret } from "../validators.js";
import { TableName, UpdateResult, UpdateArgs } from "./types.js";

/**
 * Universal update mutation that works with ANY table
 * Supports both single record and batch updates
 *
 * @param tableName - Name of the table to update
 * @param data - Array of {id, updates} objects (type-safe based on tableName)
 * @returns Array of IDs for successfully updated records (type-safe based on tableName)
 * @throws Error if any update fails (atomic transaction - all or nothing)
 *
 * @example
 * const updatedIds = await update({
 *   tableName: 'sites',
 *   data: [{ id: siteId, updates: { name: 'New Name' } }]
 * });
 * // updatedIds is typed as Id<'sites'>[]
 */
export const update = mutation({
  args: {
    tableName: TableName,
    data: v.array(
      v.object({
        id: v.string(),
        updates: v.object({}), // Any object shape for updates
      })
    ),
  },
  handler: async <T extends keyof DataModel>(
    ctx: any,
    args: UpdateArgs<T>
  ): Promise<UpdateResult<T>> => {
    const identity = await isAuthenticated(ctx);
    const { tableName, data } = args;
    const now = Date.now();

    if (!Array.isArray(data) || data.length === 0) {
      throw new Error("Update failed: data must be a non-empty array");
    }

    try {
      // Handle batch update atomically
      await Promise.all(
        data.map(async (item, index) => {
          try {
            const record = await ctx.db.get(item.id);

            if (!record) {
              throw new Error(
                `Record not found with id "${item.id}"`
              );
            }

            if ((record as any).tenantId !== identity.tenantId) {
              throw new Error("Access denied - tenant mismatch");
            }

            const patchData = {
              ...cleanUpdates(item.updates),
              updatedAt: now,
            };

            await ctx.db.patch(item.id, patchData as any);
          } catch (error) {
            throw new Error(
              `Update failed at index ${index} in table "${String(tableName)}" (id: ${item.id}): ${
                error instanceof Error ? error.message : String(error)
              }`
            );
          }
        })
      );

      // Return all updated record IDs
      return data.map((item) => item.id);
    } catch (error) {
      // Re-throw with context about the batch operation
      throw new Error(
        `Batch update failed for table "${String(tableName)}" (attempted ${data.length} records): ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  },
});

/**
 * _s update function (no auth required, uses secret validation)
 *
 * @example
 * const updatedIds = await update_s({
 *   tableName: 'sites',
 *   data: [{ id: siteId, updates: { name: 'New Name' } }],
 *   secret: process.env.CONVEX_API_KEY
 * });
 * // updatedIds is typed as Id<'sites'>[]
 */
export const update_s = mutation({
  args: {
    tableName: TableName,
    data: v.array(
      v.object({
        id: v.string(),
        updates: v.object({}),
      })
    ),
    secret: v.string(),
  },
  handler: async <T extends keyof DataModel>(
    ctx: any,
    args: UpdateArgs<T> & { secret: string }
  ): Promise<UpdateResult<T>> => {
    await isValidSecret(args.secret);
    const { tableName, data } = args;
    const now = Date.now();

    if (!Array.isArray(data) || data.length === 0) {
      throw new Error("Update failed: data must be a non-empty array");
    }

    try {
      // Handle batch update atomically
      await Promise.all(
        data.map(async (item, index) => {
          try {
            const record = await ctx.db.get(item.id);

            if (!record) {
              throw new Error(
                `Record not found with id "${item.id}"`
              );
            }

            const patchData = {
              ...cleanUpdates(item.updates),
              updatedAt: now,
            };

            await ctx.db.patch(item.id, patchData as any);
          } catch (error) {
            throw new Error(
              `Update failed at index ${index} in table "${String(tableName)}" (id: ${item.id}): ${
                error instanceof Error ? error.message : String(error)
              }`
            );
          }
        })
      );

      // Return all updated record IDs
      return data.map((item) => item.id);
    } catch (error) {
      // Re-throw with context about the batch operation
      throw new Error(
        `Batch update failed for table "${String(tableName)}" (attempted ${data.length} records): ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  },
});
