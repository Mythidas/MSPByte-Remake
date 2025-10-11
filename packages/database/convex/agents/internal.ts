import { v } from "convex/values";
import { action, internalMutation } from "../_generated/server.js";
import { internal } from "../_generated/api.js";

/**
 * Internal mutation to create an API log entry
 * Only callable from actions or other internal functions
 */
export const _createApiLog = internalMutation({
  args: {
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
  handler: async (ctx, args) => {
    await ctx.db.insert("agent_api_logs", {
      ...args,
      createdAt: new Date().getTime(),
      updatedAt: new Date().getTime(),
    });
  },
});

/**
 * Public action to create an API log entry
 * Validates API secret before executing
 */
export const createApiLog = action({
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
    if (secret !== process.env.CONVEX_API_SECRET) {
      throw new Error("Unauthorized: Invalid secret");
    }

    await ctx.runMutation(internal.agents.internal._createApiLog, args);
  },
});
