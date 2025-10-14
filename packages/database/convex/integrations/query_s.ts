import { v } from "convex/values";
import { query } from "../_generated/server.js";
import { isValidSecret } from "../helpers/validators.js";

export const getBySlug = query({
  args: {
    slug: v.string(),
    secret: v.string(),
  },
  handler: async (ctx, args) => {
    await isValidSecret(args.secret);
    return await ctx.db
      .query("integrations")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
  },
});
