import { query } from "../_generated/server.js";
import { isAuthenticated } from "../helper.js";

export const getSites = query({
  args: {},
  handler: async (ctx, args) => {
    const identity = await isAuthenticated(ctx);
  },
});
