import { api } from '$lib/convex';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	// Check if user is authenticated
	const isAuthenticated = !!locals.auth?.accessToken;

	// If authenticated, fetch user data
	if (isAuthenticated) {
		try {
			const user = await locals.client.query(api.users.query.getCurrentUser, {});

			return {
				isAuthenticated: true,
				user
			};
		} catch (error) {
			// User token might be invalid, treat as not authenticated
			return {
				isAuthenticated: false
			};
		}
	}

	return {
		isAuthenticated: false
	};
};
