import { ORM } from '$lib/database/orm.js';
import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types.js';
import { generateUUID } from '@workspace/shared/lib/utils.server.js';
import { getConnector } from '@workspace/shared/lib/connectors/index.js';
import SophosPartnerConnector from '@workspace/shared/lib/connectors/SophosPartnerConnector.js';

export const load: PageServerLoad = async ({ locals, params }) => {
	const orm = new ORM(locals.auth.supabase);

	const [{ data: integration }, { data: dataSource }] = await Promise.all([
		await orm.getRow('integrations', {
			filters: [['id', 'eq', params.id]]
		}),
		await orm.getRow('data_sources', {
			filters: [
				['integration_id', 'eq', params.id],
				['site_id', 'eq', await generateUUID(true)]
			]
		})
	]);

	if (!integration) {
		error(404, 'Not found');
	}

	return { integration, dataSource, user: locals.auth.user };
};
