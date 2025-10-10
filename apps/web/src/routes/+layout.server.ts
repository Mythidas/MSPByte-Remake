import { buildClerkProps } from 'svelte-clerk/server';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	// Get user token from Clerk for Convex
	const auth = locals.auth();
	return {
		token: locals.token,
		...buildClerkProps(auth)
	};
};
