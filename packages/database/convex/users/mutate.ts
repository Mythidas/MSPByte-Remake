import { v } from "convex/values";
import { mutation } from "../_generated/server.js";
import { isAuthenticated, isValidSecret } from "../helpers/validators.js";

export const updateMyMetadata = mutation({
    args: {
        metadata: v.object({
            currentSite: v.optional(v.id("sites")),
        }),
    },
    handler: async (ctx, args) => {
        const identity = await isAuthenticated(ctx);
        await ctx.db.patch(identity._id, {
            metadata: args.metadata,
        });
    },
});

export const updateUserLastActivity_s = mutation({
    args: {
        secret: v.string(),
        id: v.id("users"),
    },
    handler: async (ctx, args) => {
        await isValidSecret(args.secret);
        await ctx.db.patch(args.id, { lastActivityAt: Date.now() })
    },
});
