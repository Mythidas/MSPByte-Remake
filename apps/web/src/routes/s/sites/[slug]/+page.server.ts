import { ORM } from '$lib/database/orm.js';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types.js';

export const load: PageServerLoad = async ({ locals, params }) => {
	const orm = new ORM(locals.auth.supabase);

	const { data, error: siteError } = await orm.getRow('sites_view', {
		filters: [['slug', 'eq', params.slug]]
	});

	if (siteError) {
		return error(404, 'Site not found');
	}

	return {
		site: data
	};
};
