import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types.js';
import { getConnector } from '@workspace/shared/lib/connectors/index.js';
import { ENCRYPTION_KEY } from '$env/static/private';
import type { IntegrationType } from '@workspace/shared/types/pipeline/core.js';
import Encryption from '@workspace/shared/lib/Encryption.js';
import { api, type Doc, type Id } from '$lib/convex';

// Load function removed - data is now fetched client-side via Convex for reactivity
export const load: PageServerLoad = async ({ locals, params }) => {
    const integration = await locals.client.query(api.integrations.query.getBySlug, {
        slug: params.slug
    });
    if (!integration) redirect(307, `/error?error=${encodeURIComponent("Failed to find integration")}`)

    return {
        integration
    }
}

export const actions = {
    testConnection: async ({ request, locals }) => {
        const formData = await request.formData();
        const dataSourceId = formData.get('dataSourceId') as string;
        const integrationId = formData.get('integrationId') as string;

        if (!dataSourceId || !integrationId) {
            return fail(400, { success: false, message: 'dataSourceId and integrationId are required' });
        }

        const dataSource = (await locals.client.query(api.helpers.orm.get, {
            tableName: 'data_sources',
            id: dataSourceId as any
        })) as Doc<'data_sources'>;

        if (!dataSource) {
            return fail(404, { success: false, message: 'Data source not found' });
        }

        const connector = getConnector(
            integrationId as IntegrationType,
            dataSource.config,
            ENCRYPTION_KEY
        );

        if (!connector) {
            return fail(500, { success: false, message: 'Failed to get valid connector' });
        }

        const { data, error: healthError } = await connector.checkHealth();

        if (healthError) {
            return fail(500, { success: false, message: 'Failed to validate connection' });
        }

        if (data) {
            return { success: true, message: 'Connection is successful!' };
        }

        return fail(500, { success: false, message: 'Failed to validate connection' });
    },

    saveConfig: async ({ request, locals }) => {
        const formData = await request.formData();
        const dataSourceId = formData.get('dataSourceId') as string;
        const integrationId = formData.get('integrationId') as string;
        const configJson = formData.get('config') as string;
        const originalConfigJson = formData.get('originalConfig') as string;

        if (!dataSourceId || !integrationId || !configJson) {
            return fail(400, { success: false, message: 'Missing required fields' });
        }

        const integration = await locals.client.query(api.integrations.query.get, {
            id: integrationId as any
        });

        if (!integration) {
            return fail(404, { success: false, message: 'Integration not found' });
        }

        // Parse the config
        let config: Record<string, any>;
        let originalConfig: Record<string, any>;
        try {
            config = JSON.parse(configJson);
            originalConfig = JSON.parse(originalConfigJson);
        } catch {
            return fail(400, { success: false, message: 'Invalid config format' });
        }

        // Encrypt sensitive fields based on config_schema
        const configSchema = integration.configSchema as Record<string, { sensitive?: boolean }>;
        const processedConfig: Record<string, any> = {};
        const expiration = config['expiration'] as number | undefined;

        for (const [key, value] of Object.entries(config)) {
            if (!configSchema[key]) continue;

            if (configSchema[key]?.sensitive && value) {
                // Only encrypt if value is not empty (user provided new value)
                processedConfig[key] = await Encryption.encrypt(value, ENCRYPTION_KEY);
            } else if (value) {
                processedConfig[key] = value;
            }
        }

        for (const [key, value] of Object.entries(originalConfig)) {
            if (processedConfig[key]) continue;
            processedConfig[key] = value;
        }

        const data = (await locals.client.mutation(api.helpers.orm.update, {
            tableName: 'data_sources',
            data: [
                {
                    id: dataSourceId as any,
                    updates: {
                        config: processedConfig,
                        credentialExpirationAt: expiration
                    }
                }
            ]
        })) as Id<'data_sources'>[];

        if (!data) {
            return fail(500, { success: false, message: 'Failed to save configuration' });
        }

        await locals.client.mutation(api.scheduledjobs.mutate.scheduleJobsByIntegration, {
            integrationId: integration._id,
            dataSourceId: data[0]
        });

        return { success: true, message: 'Configuration saved successfully!' };
    }
} satisfies Actions;
