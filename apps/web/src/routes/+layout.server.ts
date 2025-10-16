import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	// Get user token from Clerk for Convex
	return {
		token: locals.auth.accessToken
	};
};
