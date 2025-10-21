import { api, type Doc } from '$lib/convex/index.js';
import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types.js';

export const load: LayoutServerLoad = async ({ locals, url }) => {
	try {
		const slug = url.pathname.split('/').filter(Boolean).pop();
		const integration = await locals.client.query(api.integrations.query.getBySlug, {
			slug: slug!
		});

		return {
			integration: integration as Doc<'integrations'>
		};
	} catch {
		redirect(
			303,
			`/error?error=${encodeURIComponent('Failed to fetch the integration for this page.')}`
		);
	}
};
