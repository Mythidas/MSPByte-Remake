import { v } from "convex/values";
import { mutation } from "../_generated/server";

export const updateEntitiesState = mutation({
    args: {
        state: v.string()
    },
    handler: async (ctx, args) => {
        const entities = await ctx.db.query("entities").collect();

        Promise.all(entities.map(async (entity) => {
            await ctx.db.patch(entity._id, { state: args.state as any })
        }));
    }
})
