import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types.js';
import { api, type Doc, type Id } from '$lib/convex';
import { CONVEX_API_KEY } from "$env/static/private";

export const load: PageServerLoad = async ({ locals, params }) => {
    // Get the Sophos Partner integration
    const integration = await locals.client.query(api.integrations.query.getBySlug, {
        slug: 'sophos-partner'
    });

    if (!integration) {
        redirect(307, `/error?error=${encodeURIComponent('Sophos Partner integration not found')}`);
    }

    const site = await locals.client.query(api.helpers.orm.get_s, {
        tableName: 'sites',
        index: {
            name: 'by_slug',
            params: {
                slug: params.slug
            }
        },
        secret: CONVEX_API_KEY
    });

    if (!site) {
        redirect(307, `/error?error=${encodeURIComponent(`No site found with this slug: ${params.slug}`)}`);
    }

    // Get the data source link for this site and integration
    const dataSource = (await locals.client.query(api.helpers.orm.get_s, {
        tableName: 'data_sources',
        index: {
            name: 'by_site',
            params: {
                siteId: site._id,
            }
        },
        filters: {
            integrationId: integration._id
        },
        secret: CONVEX_API_KEY
    })) as Doc<'data_sources'>;

    if (!dataSource) {
        redirect(307, `/error?error=${encodeURIComponent('Data source not found')}`);
    }

    return {
        dataSource: dataSource
    };
};
