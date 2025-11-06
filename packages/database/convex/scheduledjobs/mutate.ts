import { v } from "convex/values";
import { mutation } from "../_generated/server.js";
import { isAuthenticated } from "../helpers/validators.js";

export const createScheduledJob = mutation({
    args: {
        integrationId: v.id("integrations"),
        dataSourceId: v.id("data_sources"),
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

        // Fetch integration to get slug for event routing
        const integration = await ctx.db.get(args.integrationId);
        if (!integration) {
            throw new Error(`Integration not found: ${args.integrationId}`);
        }

        await ctx.db.insert("scheduled_jobs", {
            tenantId: identity.tenantId,
            ...args,
            integrationSlug: integration.slug,
            createdBy: identity.email,
            scheduledAt: new Date().getTime(),
            updatedAt: new Date().getTime(),
        });
    },
});

export const scheduleJobsByIntegration = mutation({
    args: {
        integrationId: v.id("integrations"),
        dataSourceId: v.id("data_sources"),
    },
    handler: async (ctx, args) => {
        const identity = await isAuthenticated(ctx);

        // Fetch integration to get slug and supportedTypes config
        const integration = await ctx.db.get(args.integrationId);
        if (!integration) {
            throw new Error(`Integration not found: ${args.integrationId}`);
        }

        // Fetch data source to check last sync times
        const dataSource = await ctx.db.get(args.dataSourceId);
        if (!dataSource) {
            throw new Error(`Data source not found: ${args.dataSourceId}`);
        }

        const currentTime = Date.now();
        const metadata = (dataSource.metadata as Record<string, any>) || {};

        for (const type of integration.supportedTypes) {
            const action = `sync.${type.type}`;
            const priority = type.priority ?? 5; // Default priority: 5
            const rateMinutes = type.rateMinutes ?? 60; // Default rate: 60 minutes
            const rateMs = rateMinutes * 60 * 1000;

            // Check last sync time from metadata
            const lastSyncAt = metadata[action] || 0;
            const nextAllowedTime = lastSyncAt + rateMs;

            // Calculate when to schedule: either now (if enough time passed) or next allowed time
            const scheduledAt = currentTime >= nextAllowedTime ? currentTime : nextAllowedTime;

            // Only schedule if not already pending for this action
            const existingPendingJob = await ctx.db
                .query("scheduled_jobs")
                .withIndex("by_data_source_status", (q) =>
                    q.eq("dataSourceId", args.dataSourceId).eq("status", "pending")
                )
                .filter((q) => q.eq(q.field("action"), action))
                .first();

            if (existingPendingJob) {
                console.log(`Skipping ${action}: pending job already exists`);
                continue;
            }

            await ctx.db.insert("scheduled_jobs", {
                tenantId: identity.tenantId,
                integrationId: args.integrationId,
                integrationSlug: integration.slug,
                dataSourceId: args.dataSourceId,
                action,
                payload: {},
                priority,
                status: "pending",
                createdBy: identity.email,
                scheduledAt,
                updatedAt: currentTime,
            });
        }

        return true;
    },
});
