import { mutation, QueryCtx, MutationCtx } from "./_generated/server.js";
import type { MutationBuilder } from "convex/server";
import { DataModel } from "./_generated/dataModel.js";
import { UserJWT } from "./types.js";

export type AuthenticatedMutationCtx = MutationCtx & { identity: UserJWT };

export const isAuthenticated = async (ctx: QueryCtx) => {
  const identity = (await ctx.auth.getUserIdentity()) as UserJWT | undefined;
  if (!identity) {
    throw new Error("Unauthorized: No identntiy found");
  }

  return identity;
};

export const useAuthMutation: MutationBuilder<DataModel, "public"> = ((
  funcOrOptions: any
) => {
  // Support both function-only and options object patterns
  if (typeof funcOrOptions === "function") {
    // Function-only pattern: mutation(async (ctx) => ...)
    return mutation(async (ctx: MutationCtx) => {
      const identity = await ctx.auth.getUserIdentity();
      if (!identity) {
        throw new Error("Unauthorized: User must be authenticated");
      }
      return funcOrOptions({ ...ctx, identity });
    });
  }

  // Options pattern: mutation({ args: ..., handler: ... })
  const { args, handler } = funcOrOptions;
  return mutation({
    args,
    handler: async (ctx: MutationCtx, mutationArgs: any) => {
      const identity = await ctx.auth.getUserIdentity();
      if (!identity) {
        throw new Error("Unauthorized: User must be authenticated");
      }
      return handler({ ...ctx, identity }, mutationArgs);
    },
  });
}) as MutationBuilder<DataModel, "public">;
