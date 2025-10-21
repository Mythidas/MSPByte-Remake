import { api } from '$lib/convex';
import type { LayoutServerLoad } from './$types.js';
import { authKit } from '@workos/authkit-sveltekit';
import { redirect } from '@sveltejs/kit';

export const load: LayoutServerLoad = authKit.withAuth(async ({ locals }) => {
	try {
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
			? locals.client.query(api.helpers.orm.get, {
					tableName: 'data_sources',
					index: {
						name: 'by_integration_primary',
						params: {
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
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
		redirect(303, `/error?error=${encodeURIComponent(errorMessage)}`);
	}
});
