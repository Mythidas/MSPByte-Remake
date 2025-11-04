import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types.js';
import { api, type Doc, type Id } from '$lib/convex';
import { CONVEX_API_KEY } from "$env/static/private";

export const load: PageServerLoad = async ({ locals, params }) => {
    // Get the Microsoft 365 integration
    const integration = await locals.client.query(api.integrations.query.getBySlug, {
        slug: 'microsoft-365'
    });

    if (!integration) {
        redirect(307, `/error?error=${encodeURIComponent('Microsoft 365 integration not found')}`);
    }

    // Get the site by slug
    const sites = (await locals.client.query(api.helpers.orm.list_s, {
        tableName: 'sites',
        secret: CONVEX_API_KEY,
        index: {
            name: 'by_slug',
            params: {
                slug: params.slug,
            }
        },
    })) as Doc<'sites'>[];

    if (!sites || sites.length === 0) {
        redirect(307, `/error?error=${encodeURIComponent('Site not found')}`);
    }

    const site = sites[0];

    // Get the data source link for this site and integration
    const dataSourceLinks = (await locals.client.query(api.helpers.orm.list, {
        tableName: 'data_source_to_site' as const,
        index: {
            name: 'by_site',
            params: {
                siteId: site._id,
            }
        },
        filters: {
            integrationId: integration._id
        }
    })) as Doc<'data_source_to_site'>[];

    if (!dataSourceLinks || dataSourceLinks.length === 0) {
        redirect(
            307,
            `/error?error=${encodeURIComponent('No Microsoft 365 data source configured for this site')}`
        );
    }

    // Get the actual data source
    const dataSource = (await locals.client.query(api.helpers.orm.get, {
        tableName: 'data_sources' as const,
        id: dataSourceLinks[0].dataSourceId
    })) as Doc<'data_sources'>;

    if (!dataSource) {
        redirect(307, `/error?error=${encodeURIComponent('Data source not found')}`);
    }

    return {
        dataSourceId: dataSource._id
    };
};
