import { CONVEX_API_KEY } from '$env/static/private';
import { api, type Doc } from '$lib/convex';
import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, params }) => {
    // First, get the site ID by slug
    const siteBySlug = await locals.client.query(api.helpers.orm.get_s, {
        tableName: 'sites',
        index: {
            name: 'by_slug',
            params: {
                slug: params.slug
            }
        },
        secret: CONVEX_API_KEY
    });

    if (!siteBySlug) throw redirect(307, `/error?${encodeURIComponent('error=Failed to load the site data')}`)

    // Then fetch the full site with integrations view
    const site = await locals.client.query(api.sites.query.getSiteWithIntegrationsView, {
        id: siteBySlug._id
    });

    return {
        site: site as Doc<'sites'> & { linkedIntegrations: any[] }
    };
};
