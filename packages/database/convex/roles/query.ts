import { query } from "../_generated/server.js";
import { isAuthenticated } from "../helpers/validators.js";

export const getGlobal = query({
  args: {},
  handler: async (ctx) => {
    await isAuthenticated(ctx);
    return await ctx.db
      .query("roles")
      .withIndex("by_tenant", (q) => q.eq("tenantId", undefined))
      .collect();
  },
});
