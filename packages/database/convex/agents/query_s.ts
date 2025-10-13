import { v } from "convex/values";
import { query } from "../_generated/server.js";
import { isValidSecret } from "../helpers/validators.js";

export const getByGuid = query({
  args: {
    guid: v.string(),
    secret: v.string(),
  },
  handler: async (ctx, args) => {
    await isValidSecret(args.secret);

    return await ctx.db
      .query("agents")
      .withIndex("by_guid", (q) => q.eq("guid", args.guid))
      .unique();
  },
});
