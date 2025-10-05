import { ORM } from '$lib/database/orm.js';
import { generateUUID } from '@workspace/shared/lib/utils.server.js';
import type { PageServerLoad } from './$types.js';

export const load: PageServerLoad = async ({ locals }) => {
	const orm = new ORM(locals.auth.supabase);

	const [{ data: integrations }, { data: dataSources }] = await Promise.all([
		await orm.getRows('integrations_view'),
		await orm.getRows('data_sources', {
			filters: [['site_id', 'eq', await generateUUID(true)]]
		})
	]);

	return {
		integrations: integrations?.rows || [],
		dataSources: dataSources?.rows || []
	};
};
