import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types.js';
import { getConnector } from '@workspace/shared/lib/connectors/index.js';
import { ENCRYPTION_KEY } from '$env/static/private';
import type { IntegrationType } from '@workspace/shared/types/pipeline/core.js';
import Encryption from '@workspace/shared/lib/Encryption.js';
import { api } from '$lib/convex';
import { superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { m365ConnectionSchema } from './helpers/integration/schemas.js';
import type { M365ConsentCallback } from '$lib/types/callbacks.js';
import { PUBLIC_MICROSOFT_CLIENT_ID, PUBLIC_ORIGIN } from '$env/static/public';

// Load function removed - data is now fetched client-side via Convex for reactivity

export const actions = {
	testConnection: async ({ request, locals }) => {
		const formData = await request.formData();
		const dataSourceId = formData.get('dataSourceId') as string;
		const integrationId = formData.get('integrationId') as string;

		if (!dataSourceId || !integrationId) {
			return fail(400, { success: false, message: 'dataSourceId and integrationId are required' });
		}

		const dataSource = await locals.client.query(api.datasources.crud.get, {
			id: dataSourceId as any
		});

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

		const data = await locals.client.mutation(api.datasources.crud.update, {
			id: dataSourceId as any,
			updates: {
				config: processedConfig,
				credentialExpirationAt: expiration
			}
		});

		if (!data) {
			return fail(500, { success: false, message: 'Failed to save configuration' });
		}

		await locals.client.mutation(api.scheduledjobs.mutate.scheduleJobsByIntegration, {
			integrationId: integration._id,
			dataSourceId: data._id
		});

		return { success: true, message: 'Configuration saved successfully!' };
	}
} satisfies Actions;
