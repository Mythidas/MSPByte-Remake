import { mutation } from './_generated/server.js';
import type { QueryCtx, MutationCtx } from './_generated/server.js';
import type { MutationBuilder } from 'convex/server';
import type { DataModel } from './_generated/dataModel.js';
import type { UserJWT } from './types.js';

export type AuthenticatedMutationCtx = MutationCtx & { identity: UserJWT };

export const isAuthenticated = async (ctx: QueryCtx) => {
	const identity = (await ctx.auth.getUserIdentity()) as UserJWT | undefined;
	if (!identity) {
		throw new Error('Unauthorized: No identity found');
	}
	const user = await ctx.db
		.query('users')
		.withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.id))
		.unique();
	if (!user) {
		throw new Error('Unauthorized: User does not exist');
	}

	const tenant = await ctx.db.get(user.tenantId);
	if (!tenant) {
		throw new Error('Unauthorized: Tenant not found');
	}

	return {
		...user
	};
};

export const isValidTenant = async (first: string, second: string) => {
	if (first !== second) {
		throw new Error('Unauthorized: Invalid tenant');
	}

	return true;
};

export const useAuthMutation: MutationBuilder<DataModel, 'public'> = ((funcOrOptions: any) => {
	// Support both function-only and options object patterns
	if (typeof funcOrOptions === 'function') {
		// Function-only pattern: mutation(async (ctx) => ...)
		return mutation(async (ctx: MutationCtx) => {
			const identity = await ctx.auth.getUserIdentity();
			if (!identity) {
				throw new Error('Unauthorized: User must be authenticated');
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
				throw new Error('Unauthorized: User must be authenticated');
			}
			return handler({ ...ctx, identity }, mutationArgs);
		}
	});
}) as MutationBuilder<DataModel, 'public'>;
