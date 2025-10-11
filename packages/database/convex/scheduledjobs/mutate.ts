import { v } from "convex/values";
import { mutation } from "../_generated/server.js";
import { isAuthenticated } from "../helpers/validators.js";

export const createScheduledJob = mutation({
  args: {
    integrationId: v.id("integrations"),
    dataSourceId: v.optional(v.id("data_sources")),
    action: v.string(),
    payload: v.any(),
    priority: v.optional(v.number()),
    status: v.union(
      v.literal("pending"),
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed")
    ),
    attemptsMax: v.optional(v.number()),
    scheduledAt: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await isAuthenticated(ctx);
    await ctx.db.insert("scheduled_jobs", {
      tenantId: identity.tenantId,
      ...args,
      createdBy: identity.email,
      scheduledAt: new Date().getTime(),
      createdAt: new Date().getTime(),
      updatedAt: new Date().getTime(),
    });
  },
});

export const scheduleJobsByIntegration = mutation({
  args: {
    integrationId: v.id("integrations"),
    supportedTypes: v.array(v.string()),
    dataSourceId: v.optional(v.id("data_sources")),
  },
  handler: async (ctx, args) => {
    const identity = await isAuthenticated(ctx);
    for (const type of args.supportedTypes) {
      await ctx.db.insert("scheduled_jobs", {
        tenantId: identity.tenantId,
        integrationId: args.integrationId,
        dataSourceId: args.dataSourceId,
        action: `sync.${type}`,
        payload: {},
        priority: 10,
        status: "pending",
        createdBy: identity.email,
        scheduledAt: new Date().getTime(),
        createdAt: new Date().getTime(),
        updatedAt: new Date().getTime(),
      });
    }
  },
});
