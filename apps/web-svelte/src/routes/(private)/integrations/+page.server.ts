import { ORM } from '$lib/database/orm.js';
import type { PageServerLoad } from './$types.js';

export const load: PageServerLoad = async ({ locals }) => {
	const orm = new ORM(locals.auth.supabase);

	const { data } = await orm.getRows('integrations_view');

	return {
		rows: data?.rows || []
	};
};
