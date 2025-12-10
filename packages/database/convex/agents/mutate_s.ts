import { v } from "convex/values";
import { mutation } from "../_generated/server.js";
import { isValidSecret } from "../helpers/validators.js";

/**
 * Public action to create an API log entry
 * Validates API secret before executing
 */
export const createApiLog = mutation({
  args: {
    secret: v.string(),
    tenantId: v.id("tenants"),
    siteId: v.id("sites"),
    agentId: v.id("agents"),
    endpoint: v.string(),
    method: v.string(),
    statusCode: v.number(),
    externalId: v.optional(v.string()),
    psaSiteId: v.optional(v.string()),
    rmmDeviceId: v.optional(v.string()),
    reqMetadata: v.any(),
    resMetadata: v.any(),
    timeElapsedMs: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, { secret, ...args }) => {
    await isValidSecret(secret);

    await ctx.db.insert("agent_api_logs", {
      ...args,
      updatedAt: new Date().getTime(),
    });
  },
});

// ============================================================================
// BULK OPERATIONS
// ============================================================================

/**
 * Batch update for agent status and metadata.
 * Efficiently updates multiple agents' status and metadata in a single mutation.
 * Used by heartbeat manager to batch all agent updates.
 */
export const batchUpdate = mutation({
  args: {
    secret: v.string(),
    updates: v.array(
      v.object({
        id: v.id("agents"),
        status: v.union(
          v.literal("online"),
          v.literal("offline"),
          v.literal("unknown"),
        ),
        statusChangedAt: v.number(),
        lastCheckinAt: v.optional(v.number()),
        guid: v.optional(v.string()),
        hostname: v.optional(v.string()),
        version: v.optional(v.string()),
        ipAddress: v.optional(v.string()),
        extAddress: v.optional(v.string()),
        macAddress: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    await isValidSecret(args.secret);

    const results: Array<{
      id: string;
      success: boolean;
      error?: string;
    }> = [];
    const now = Date.now();

    for (const update of args.updates) {
      const agent = await ctx.db.get(update.id);
      if (!agent) {
        results.push({
          id: update.id,
          success: false,
          error: "Agent not found",
        });
        continue;
      }

      // Build patch object with only provided fields
      const patch: Record<string, any> = {
        status: update.status,
        statusChangedAt: update.statusChangedAt,
        updatedAt: now,
      };

      if (update.lastCheckinAt !== undefined)
        patch.lastCheckinAt = update.lastCheckinAt;
      if (update.guid !== undefined) patch.guid = update.guid;
      if (update.hostname !== undefined) patch.hostname = update.hostname;
      if (update.version !== undefined) patch.version = update.version;
      if (update.ipAddress !== undefined) patch.ipAddress = update.ipAddress;
      if (update.extAddress !== undefined) patch.extAddress = update.extAddress;
      if (update.macAddress !== undefined) patch.macAddress = update.macAddress;

      await ctx.db.patch(update.id, patch);

      results.push({ id: update.id, success: true });
    }

    return {
      totalUpdated: results.filter((r) => r.success).length,
      totalFailed: results.filter((r) => !r.success).length,
      results,
    };
  },
});

/**
 * Legacy batch update for agent status only.
 * @deprecated Use batchUpdate instead.
 */
export const batchUpdateStatus = mutation({
  args: {
    secret: v.string(),
    updates: v.array(
      v.object({
        id: v.id("agents"),
        status: v.union(
          v.literal("online"),
          v.literal("offline"),
          v.literal("unknown"),
        ),
        statusChangedAt: v.number(),
        lastCheckinAt: v.optional(v.number()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    await isValidSecret(args.secret);

    const results: Array<{
      id: string;
      success: boolean;
      error?: string;
    }> = [];
    const now = Date.now();

    for (const update of args.updates) {
      const agent = await ctx.db.get(update.id);
      if (!agent) {
        results.push({
          id: update.id,
          success: false,
          error: "Agent not found",
        });
        continue;
      }

      const patch: Record<string, any> = {
        status: update.status,
        statusChangedAt: update.statusChangedAt,
        updatedAt: now,
      };

      if (update.lastCheckinAt !== undefined)
        patch.lastCheckinAt = update.lastCheckinAt;

      await ctx.db.patch(update.id, patch);

      results.push({ id: update.id, success: true });
    }

    return {
      totalUpdated: results.filter((r) => r.success).length,
      totalFailed: results.filter((r) => !r.success).length,
      results,
    };
  },
});
