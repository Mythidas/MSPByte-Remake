import { v } from 'convex/values';
import { mutation } from '../_generated/server.js';
import { isAuthenticated, isValidTenant } from '../helper.js';

export const updateConfig = mutation({
	args: {
		id: v.id('data_sources'),
		config: v.any()
	},
	handler: async (ctx, args) => {
		const identity = await isAuthenticated(ctx);
		const resource = await ctx.db.get(args.id);
		if (!resource) throw new Error('Resources not found');

		await isValidTenant(identity.tenantId, resource.tenantId);
		await ctx.db.patch(args.id, {
			config: args.config
		});

		return {
			...resource,
			config: args.config
		};
	}
});

export const disable = mutation({
	args: {
		id: v.id('data_sources')
	},
	handler: async (ctx, args) => {
		const identity = await isAuthenticated(ctx);
		const dataSource = await ctx.db.get(args.id);
		if (!dataSource) throw new Error('Resource not found');
		await isValidTenant(identity.tenantId, dataSource.tenantId);

		await ctx.db.patch(args.id, {
			status: 'inactive',
			deletedAt: new Date().getTime()
		});

		return true;
	}
});

export const enable = mutation({
	args: {
		id: v.id('data_sources')
	},
	handler: async (ctx, args) => {
		const identity = await isAuthenticated(ctx);
		const dataSource = await ctx.db.get(args.id);
		if (!dataSource) throw new Error('Resource not found');
		await isValidTenant(identity.tenantId, dataSource.tenantId);

		await ctx.db.patch(args.id, {
			status: 'active',
			deletedAt: undefined
		});

		return true;
	}
});

export const createPrimaryForIntegration = mutation({
	args: {
		integrationId: v.id('integrations')
	},
	handler: async (ctx, args) => {
		const identity = await isAuthenticated(ctx);
		const integration = await ctx.db.get(args.integrationId);
		if (!integration) throw new Error('Resource not found');

		const newDataSource = await ctx.db.insert('data_sources', {
			tenantId: identity.tenantId,
			integrationId: args.integrationId,
			status: 'active',
			config: {},
			credentialExpirationAt: Number.MAX_SAFE_INTEGER,
			isPrimary: true,
			createdAt: new Date().getTime(),
			updatedAt: new Date().getTime()
		});

		return await ctx.db.get(newDataSource);
	}
});
