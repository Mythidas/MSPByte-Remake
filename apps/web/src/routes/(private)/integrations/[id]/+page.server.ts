import { ORM } from '$lib/database/orm.js';
import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types.js';
import { generateUUID } from '@workspace/shared/lib/utils.server.js';
import { getConnector } from '@workspace/shared/lib/connectors/index.js';
import { ENCRYPTION_KEY } from '$env/static/private';
import type { IntegrationType } from '@workspace/shared/types/pipeline/core.js';
import Encryption from '@workspace/shared/lib/Encryption.js';

export const load: PageServerLoad = async ({ locals, params }) => {
	const orm = new ORM(locals.auth.supabase);

	const [{ data: integration }, { data: dataSource }] = await Promise.all([
		await orm.getRow('integrations', {
			filters: [['id', 'eq', params.id]]
		}),
		await orm.getRow('data_sources', {
			filters: [
				['integration_id', 'eq', params.id],
				['site_id', 'eq', await generateUUID(true)]
			]
		})
	]);

	if (!integration) {
		error(404, 'Not found');
	}

	return { integration, dataSource, user: locals.auth.user };
};

export const actions = {
	testConnection: async ({ request, locals }) => {
		const formData = await request.formData();
		const dataSourceId = formData.get('dataSourceId') as string;
		const integrationId = formData.get('integrationId') as string;

		if (!dataSourceId || !integrationId) {
			return fail(400, { success: false, message: 'dataSourceId and integrationId are required' });
		}

		const orm = new ORM(locals.auth.supabase);
		const { data: dataSource, error: dataSourceError } = await orm.getRow('data_sources', {
			filters: [['id', 'eq', dataSourceId]]
		});

		if (dataSourceError || !dataSource) {
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

		if (!dataSourceId || !integrationId || !configJson) {
			return fail(400, { success: false, message: 'Missing required fields' });
		}

		const orm = new ORM(locals.auth.supabase);

		// Get integration to access config_schema
		const { data: integration, error: integrationError } = await orm.getRow('integrations', {
			filters: [['id', 'eq', integrationId]]
		});

		if (integrationError || !integration) {
			return fail(404, { success: false, message: 'Integration not found' });
		}

		// Parse the config
		let config: Record<string, any>;
		try {
			config = JSON.parse(configJson);
		} catch {
			return fail(400, { success: false, message: 'Invalid config format' });
		}

		// Encrypt sensitive fields based on config_schema
		const configSchema = integration.config_schema as Record<string, { sensitive?: boolean }>;
		const processedConfig: Record<string, any> = {};

		for (const [key, value] of Object.entries(config)) {
			if (configSchema[key]?.sensitive && value) {
				// Only encrypt if value is not empty (user provided new value)
				processedConfig[key] = await Encryption.encrypt(value, ENCRYPTION_KEY);
			} else if (value) {
				processedConfig[key] = value;
			}
		}

		// Update the data source with new config
		const { data, error: updateError } = await orm.updateRow('data_sources', {
			id: dataSourceId,
			row: {
				config: processedConfig
			}
		});

		if (updateError) {
			return fail(500, { success: false, message: 'Failed to save configuration' });
		}

		await orm.insertRows('scheduled_jobs', {
			rows: integration.supported_types.map((type) => ({
				tenant_id: data.tenant_id,
				integration_id: integration.id,
				data_source_id: data.id,
				action: `sync.${type}`,
				payload: {},
				priority: 10,
				created_by: 'system',
				scheduled_at: new Date().toISOString()
			}))
		});

		return { success: true, message: 'Configuration saved successfully!' };
	}
} satisfies Actions;
