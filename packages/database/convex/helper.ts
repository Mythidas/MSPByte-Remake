import { query, QueryCtx } from "./_generated/server.js";
import type { UserIdentity } from "convex/server";

export type AuthenticatedQueryCtx = QueryCtx & { identity: UserIdentity };

export const useAuthQuery = <Output = any>(options: {
  args?: any;
  handler: (ctx: AuthenticatedQueryCtx, args: any) => Promise<Output>;
}) => {
  return query({
    args: options.args,
    handler: async (ctx, args): Promise<Output> => {
      const identity = await ctx.auth.getUserIdentity();

      if (!identity) {
        throw new Error("Unauthorized: User must be authenticated");
      }

      return options.handler({ ...ctx, identity }, args);
    },
  }) as any;
};
