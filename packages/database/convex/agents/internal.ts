import { v } from "convex/values";
import {
  action,
  internalQuery,
  internalMutation,
} from "../_generated/server.js";
import { internal } from "../_generated/api.js";
import { isValidSecret } from "../helpers/validators.js";
import { Doc } from "../_generated/dataModel.js";

/**
 * Internal query to get an agent by ID
 * Only callable from actions or other internal functions
 */
export const _getById = internalQuery({
  args: {
    id: v.id("agents"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const _getByGuid = internalQuery({
  args: {
    guid: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("agents")
      .withIndex("by_guid", (q) => q.eq("guid", args.guid))
      .unique();
  },
});

/**
 * Internal mutation to update an agent
 * Only callable from actions or other internal functions
 */
export const _update = internalMutation({
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

    return await ctx.db.get(id);
  },
});

export const _create = internalMutation({
  args: {
    tenantId: v.id("tenants"),
    siteId: v.id("sites"),
    guid: v.string(),
    hostname: v.string(),
    platform: v.string(),
    version: v.string(),
    ipAddress: v.optional(v.string()),
    macAddress: v.optional(v.string()),
    extAddress: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const agent = await ctx.db.insert("agents", {
      ...args,
      registeredAt: new Date().getTime(),
      lastCheckinAt: new Date().getTime(),
      createdAt: new Date().getTime(),
      updatedAt: new Date().getTime(),
    });

    return ctx.db.get(agent);
  },
});

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
 * Public action to get an agent by ID
 * Validates API secret before executing
 */
export const get = action({
  args: {
    id: v.id("agents"),
    secret: v.string(),
  },
  handler: async (ctx, args): Promise<Doc<"agents"> | null> => {
    if (args.secret !== process.env.CONVEX_API_SECRET) {
      throw new Error("Unauthorized: Invalid secret");
    }

    return await ctx.runQuery(internal.agents.internal._getById, {
      id: args.id,
    });
  },
});

export const getByGuid = action({
  args: {
    guid: v.string(),
    secret: v.string(),
  },
  handler: async (ctx, args): Promise<Doc<"agents"> | null> => {
    await isValidSecret(args.secret);

    return await ctx.runQuery(internal.agents.internal._getByGuid, {
      guid: args.guid,
    });
  },
});

/**
 * Public action to update an agent
 * Validates API secret before executing
 */
export const update = action({
  args: {
    id: v.id("agents"),
    secret: v.string(),
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
  handler: async (ctx, { secret, ...args }): Promise<Doc<"agents"> | null> => {
    await isValidSecret(secret);
    return await ctx.runMutation(internal.agents.internal._update, args);
  },
});

export const create = action({
  args: {
    tenantId: v.id("tenants"),
    siteId: v.id("sites"),
    guid: v.string(),
    hostname: v.string(),
    platform: v.string(),
    version: v.string(),
    ipAddress: v.optional(v.string()),
    macAddress: v.optional(v.string()),
    extAddress: v.optional(v.string()),
    secret: v.string(),
  },
  handler: async (ctx, { secret, ...rest }): Promise<Doc<"agents"> | null> => {
    await isValidSecret(secret);
    return await ctx.runMutation(internal.agents.internal._create, { ...rest });
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
