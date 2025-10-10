import { v } from 'convex/values';
import { query } from '../_generated/server.js';
import { isAuthenticated } from '../helper.js';

export const getFailedCountByDataSource = query({
	args: {
		dataSourceId: v.id('data_sources')
	},
	handler: async (ctx, args) => {
		const identity = await isAuthenticated(ctx);

		const jobs = await ctx.db
			.query('scheduled_jobs')
			.withIndex('by_data_source_status', (q) =>
				q
					.eq('dataSourceId', args.dataSourceId)
					.eq('status', 'failed')
					.eq('tenantId', identity.tenantId)
			)
			.collect();

		return jobs.length;
	}
});

export const getRecentByDataSource = query({
	args: {
		dataSourceId: v.id('data_sources')
	},
	handler: async (ctx, args) => {
		const identity = await isAuthenticated(ctx);
		return await ctx.db
			.query('scheduled_jobs')
			.withIndex('by_data_source_status', (q) =>
				q
					.eq('dataSourceId', args.dataSourceId)
					.eq('status', 'failed')
					.eq('tenantId', identity.tenantId)
			)
			.unique();
	}
});
