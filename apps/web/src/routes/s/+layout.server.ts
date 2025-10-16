import { api } from '$lib/convex';
import type { LayoutServerLoad } from './$types.js';
import { authKit } from '@workos/authkit-sveltekit';

export const load: LayoutServerLoad = authKit.withAuth(async ({ locals }) => {
	// Fetch current user — fail fast if this errors
	const user = await locals.client.query(api.users.query.getCurrentUser, {});

	const metadata = user.metadata;

	// Optional queries
	const sitePromise = metadata.currentSite
		? locals.client.query(api.sites.query.getSiteWithIntegrationsView, {
				id: metadata.currentSite
			})
		: Promise.resolve(undefined);

	const mspAgent = await locals.client.query(api.integrations.query.getBySlug, {
		slug: 'msp-agent'
	});

	const dataSourcePromise = mspAgent
		? locals.client.query(api.datasources.crud.get, {
				filters: {
					by_integration_primary: {
						integrationId: mspAgent._id,
						isPrimary: true
					}
				}
			})
		: Promise.resolve(undefined);

	const [site, mspagent] = await Promise.all([sitePromise, dataSourcePromise]);

	return {
		user,
		site,
		mspagent
	};
});
