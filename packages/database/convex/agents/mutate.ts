import { v } from "convex/values";
import { internalMutation } from "../_generated/server.js";

export const update = internalMutation({
  args: {
    id: v.id("agents"),
    siteId: v.optional(v.id("sites")),
    guid: v.optional(v.string()),
    hostname: v.optional(v.string()),
    platform: v.optional(v.string()),
    version: v.optional(v.string()),
    ipAddress: v.optional(v.string()),
    macAddress: v.optional(v.string()),
    extAddress: v.optional(v.string()),
    lastCheckinAt: v.optional(v.number()),
    deletedAt: v.optional(v.number()),
  },
  handler: async (ctx, { id, ...rest }) => {
    await ctx.db.patch(id, {
      ...rest,
      updatedAt: new Date().getTime(),
    });

    return true;
  },
});

export const createApiLog = internalMutation({
  args: {
    tenantId: v.id("tenants"),
    siteId: v.id("sites"),
    agentId: v.id("agents"),
    endpoint: v.string(),
    method: v.string(), // "GET", "POST", etc.
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
