import { v } from "convex/values";
import { internalQuery } from "../_generated/server.js";

export const get = internalQuery({
  args: {
    id: v.id("agents"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});
