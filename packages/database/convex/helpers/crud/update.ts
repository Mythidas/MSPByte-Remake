import { v } from "convex/values";
import { DataModel, Id, Doc } from "../../_generated/dataModel.js";
import { mutation } from "../../_generated/server.js";
import { cleanUpdates } from "../shortcuts.js";
import { isAuthenticated, isValidSecret } from "../validators.js";
import { TableName, UpdateResult } from "./types.js";

type UpdateItem<TableName extends keyof DataModel> = {
  id: Id<TableName>;
  updates: Partial<Doc<TableName>>;
};

/**
 * Arguments for dynamic update
 */
type DynamicUpdateArgs<TableName extends keyof DataModel> = {
  tableName: TableName;
  data: UpdateItem<TableName>[];
};

/**
 * Universal update mutation that works with ANY table
 * Supports both single record and batch updates
 *
 * @param tableName - Name of the table to update
 * @param data - Array of {id, updates} objects
 * @returns Array of IDs for successfully updated records
 * @throws Error if any update fails (atomic transaction - all or nothing)
 */
export const update = mutation({
  args: {
    tableName: TableName,
    data: v.array(
      v.object({
        id: v.string(),
        updates: v.any(),
      })
    ),
  },
  handler: async (ctx, args): Promise<UpdateResult<keyof DataModel>> => {
    const identity = await isAuthenticated(ctx);
    const { tableName, data } = args as DynamicUpdateArgs<keyof DataModel>;
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

            await ctx.db.patch(item.id, {
              ...cleanUpdates(item.updates),
              updatedAt: now,
            } as any);
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
      return data.map((item) => item.id as Id<typeof tableName>);
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
 */
export const update_s = mutation({
  args: {
    tableName: TableName,
    data: v.array(
      v.object({
        id: v.string(),
        updates: v.any(),
      })
    ),
    secret: v.string(),
  },
  handler: async (ctx, args): Promise<UpdateResult<keyof DataModel>> => {
    await isValidSecret(args.secret);
    const { tableName, data } = args as DynamicUpdateArgs<
      keyof DataModel
    > & { secret: string };
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

            await ctx.db.patch(item.id, {
              ...cleanUpdates(item.updates),
              updatedAt: now,
            } as any);
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
      return data.map((item) => item.id as Id<typeof tableName>);
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
