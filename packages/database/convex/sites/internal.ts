import { v } from "convex/values";
import { action, internalQuery } from "../_generated/server.js";
import { isValidSecret } from "../helpers/validators.js";
import { internal } from "../_generated/api.js";
import { Doc } from "../_generated/dataModel.js";

export const _get = internalQuery({
  args: {
    id: v.id("sites"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const get = action({
  args: {
    id: v.id("sites"),
    secret: v.string(),
  },
  handler: async (ctx, args): Promise<Doc<"sites"> | null> => {
    await isValidSecret(args.secret);
    return await ctx.runQuery(internal.sites.internal._get, {
      id: args.id,
    });
  },
});
