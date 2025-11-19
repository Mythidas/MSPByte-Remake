import { QueryCtx } from "../_generated/server.js";
import { UserJWT } from "../types/index.js";

export const isAuthenticated = async (ctx: QueryCtx) => {
    const identity = (await ctx.auth.getUserIdentity()) as UserJWT | undefined;
    if (!identity) {
        throw new Error("Unauthorized: No identity found");
    }
    const user = await ctx.db
        .query("users")
        .withIndex("by_clerk", (q) => q.eq("clerkId", identity.subject))
        .unique();
    if (!user) {
        throw new Error("Unauthorized: User does not exist");
    }

    const tenant = await ctx.db.get(user.tenantId);
    if (!tenant) {
        throw new Error("Unauthorized: Tenant not found");
    }

    return {
        ...user,
    };
};

export const isValidTenant = async (first: string, second: string) => {
    if (first !== second) {
        throw new Error("Unauthorized: Invalid tenant");
    }

    return true;
};

export const isValidSecret = async (secret: string) => {
    if (secret !== process.env.CONVEX_API_KEY) {
        throw new Error("Unauthorized: Invalid secret");
    }

    return true;
};
