import { v } from "convex/values";
import { mutation } from "../_generated/server.js";
import { isAuthenticated } from "../helpers/validators.js";

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
