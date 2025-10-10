import { v } from 'convex/values';
import { query } from '../_generated/server.js';
import { isAuthenticated } from '../helper.js';

export const getCurrentUser = query({
	args: {},
	handler: async (ctx, args) => {
		return await isAuthenticated(ctx);
	}
});
