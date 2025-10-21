import type { PageServerLoad } from './$types.js';

export const load: PageServerLoad = async ({ url }) => {
	const error = url.searchParams.get('error') || 'An unknown error occurred';

	return {
		error
	};
};
