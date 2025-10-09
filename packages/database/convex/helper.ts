import { query, mutation, QueryCtx, MutationCtx } from "./_generated/server.js";
import type {
  MutationBuilder,
  QueryBuilder,
  UserIdentity,
} from "convex/server";
import { DataModel } from "./_generated/dataModel.js";

export type AuthenticatedQueryCtx = QueryCtx & { identity: UserIdentity };
export type AuthenticatedMutationCtx = MutationCtx & { identity: UserIdentity };

/**
 * Create an authenticated query that requires a valid user session.
 * Preserves full Convex type safety for args and return types.
 *
 * @example
 * export const getSites = useAuthQuery({
 *   args: { limit: v.optional(v.number()) },
 *   handler: async (ctx, args) => {
 *     // ctx.identity is guaranteed to exist
 *     // args is properly typed as { limit?: number }
 *     return await ctx.db.query("sites").take(args.limit ?? 100);
 *   }
 * });
 */
export const useAuthQuery: QueryBuilder<DataModel, "public"> = ((
  funcOrOptions: any
) => {
  // Support both function-only and options object patterns
  if (typeof funcOrOptions === "function") {
    // Function-only pattern: query(async (ctx) => ...)
    return query(async (ctx: QueryCtx) => {
      const identity = await ctx.auth.getUserIdentity();
      if (!identity) {
        throw new Error("Unauthorized: User must be authenticated");
      }
      return funcOrOptions({ ...ctx, identity });
    });
  }

  // Options pattern: query({ args: ..., handler: ... })
  const { args, handler } = funcOrOptions;
  return query({
    args,
    handler: async (ctx: QueryCtx, queryArgs: any) => {
      const identity = await ctx.auth.getUserIdentity();
      if (!identity) {
        throw new Error("Unauthorized: User must be authenticated");
      }
      return handler({ ...ctx, identity }, queryArgs);
    },
  });
}) as QueryBuilder<DataModel, "public">;

/**
 * Create an authenticated mutation that requires a valid user session.
 * Preserves full Convex type safety for args and return types.
 *
 * @example
 * export const createSite = useAuthMutation({
 *   args: { name: v.string(), tenantId: v.id("tenants") },
 *   handler: async (ctx, args) => {
 *     // ctx.identity is guaranteed to exist
 *     // args is properly typed as { name: string, tenantId: Id<"tenants"> }
 *     return await ctx.db.insert("sites", {
 *       name: args.name,
 *       tenantId: args.tenantId,
 *       createdAt: Date.now(),
 *     });
 *   }
 * });
 */
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
