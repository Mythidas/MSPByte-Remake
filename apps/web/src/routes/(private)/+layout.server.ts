import { api } from '$lib/convex';
import type { LayoutServerLoad } from './$types.js';

export const load: LayoutServerLoad = async ({ locals }) => {
	const user = await locals.client.query(api.users.query.getCurrentUser, {});
	const metadata = user.metadata;
	const site = metadata.currentSite
		? await locals.client.query(api.sites.query.getSiteWithIntegrationsView, {
				id: metadata.currentSite
			})
		: undefined;

	const mspAgent = await locals.client.query(api.integrations.query.getBySlug, {
		slug: 'msp-agent'
	});
	if (mspAgent) {
		const dataSource = await locals.client.query(api.datasources.query.getPrimaryByIntegration, {
			id: mspAgent._id
		});

		return {
			user,
			site,
			mspagent: dataSource
		};
	}

	return {
		user,
		site
	};
};
