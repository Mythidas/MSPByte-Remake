import { ORM } from '$lib/database/orm.js';
import type { LayoutServerLoad } from './$types.js';

export const load: LayoutServerLoad = async ({ locals }) => {
	const orm = new ORM(locals.auth.supabase);
	const userData = locals.auth.user?.metadata as any;

	if (!userData.current_site) {
		return {
			user: locals.auth.user!,
			site: undefined
		};
	}

	const { data } = await orm.getRow('sites_view', {
		filters: [['id', 'eq', userData.current_site]]
	});

	return {
		user: locals.auth.user!,
		site: data
	};
};
