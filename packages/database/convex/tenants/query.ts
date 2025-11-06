import { v } from "convex/values";
import { query } from "../_generated/server.js";
import { isAuthenticated, isValidSecret } from "../helpers/validators.js";

export const get = query({
    args: {
        id: v.id("tenants"),
    },
    handler: async (ctx, args) => {
        const identity = await isAuthenticated(ctx);
        if (identity.tenantId !== args.id) {
            throw "User is not apart of this tenant";
        }

        return await ctx.db.get(args.id);
    },
});

export const get_s = query({
    args: {
        id: v.id("tenants"),
        secret: v.string(),
    },
    handler: async (ctx, args) => {
        await isValidSecret(args.secret);
        return await ctx.db.get(args.id);
    },
});
