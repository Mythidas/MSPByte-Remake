import { ORM } from '$lib/database/orm.js';
import { error } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types.js';

export const load: LayoutServerLoad = async ({ locals, depends }) => {
	depends('app:state');
	const orm = new ORM(locals.auth.supabase);
	const userData = locals.auth.user?.metadata as any;

	if (!userData.current_site) {
		return {
			user: locals.auth.user!,
			site: undefined
		};
	}

	const { data: enabledIntegrations } = await orm.getRow('enabled_integrations_view');
	if (!enabledIntegrations) {
		return error(404, 'Unable to find enabled integrations');
	}

	const { data: sites_view } = await orm.getRow('sites_view', {
		filters: [['id', 'eq', userData.current_site]]
	});

	const { data: siteEnabledIntegrations } = !sites_view
		? { data: undefined }
		: await orm.getRow('site_integrations_view', {
				filters: [['site_id', 'eq', sites_view.id]]
			});

	return {
		user: locals.auth.user!,
		enabledIntegrations,

		site: sites_view,
		siteEnabledIntegrations
	};
};
