import { v } from "convex/values";
import { mutation } from "../_generated/server.js";
import { isAuthenticated, isValidSecret } from "../helpers/validators.js";
import { cleanUpdates, nullable } from "../helpers/shortcuts.js";

export const updateMyMetadata = mutation({
    args: {
        currentSite: nullable(v.id("sites")),
        currentMode: nullable(v.string())
    },
    handler: async (ctx, args) => {
        const identity = await isAuthenticated(ctx);

        await ctx.db.patch(identity._id, {
            metadata: cleanUpdates(args),
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
