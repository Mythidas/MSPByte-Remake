import { CONSTANTS } from '@workspace/shared/lib/constants.js';
import { toast } from 'svelte-sonner';
import type { IntegrationState } from './types.js';

export function createIntegrationActions(state: IntegrationState) {
	state.enable = () => {
		// Trigger enable dialog in component
	};

	state.disable = () => {
		// Trigger disable dialog in component
	};

	state.confirmEnable = async () => {
		if (state.dataSource) {
			state.dataSource.status = 'active';

			const { error } = await state.orm.updateRow('data_sources', {
				id: state.dataSource.id,
				row: {
					status: 'active',
					deleted_at: null
				}
			});

			if (error) {
				state.dataSource.status = 'inactive';
				toast.error('Failed to update the integration');
				return;
			}
		} else {
			const { data } = await state.orm.insertRows('data_sources', {
				rows: [
					{
						tenant_id: state.tenantId,
						integration_id: state.integration.id,
						site_id: CONSTANTS.SENTINEL_UUID,
						config: {},
						credential_expiration_at: CONSTANTS.INFINITE_DATE
					}
				]
			});

			if (!data || !data.length) {
				toast.error('Failed to enabled integration');
				return;
			}

			state.dataSource = data[0];
			toast.info('Enabled integration successfully!');
		}

		// Create scheduled jobs for each supported type
		await state.orm.insertRows('scheduled_jobs', {
			rows: state.integration.supported_types.map((type) => ({
				tenant_id: state.tenantId,
				integration_id: state.integration.id,
				data_source_id: state.dataSource?.id,
				action: `sync.${type}`,
				payload: {},
				priority: 10,
				created_by: 'system',
				scheduled_at: new Date().toISOString()
			}))
		});
	};

	state.confirmDisable = async () => {
		if (state.dataSource) {
			state.dataSource.status = 'inactive';

			const { error } = await state.orm.updateRow('data_sources', {
				id: state.dataSource.id,
				row: {
					status: 'inactive',
					deleted_at: new Date().toISOString()
				}
			});

			if (error) {
				state.dataSource.status = 'active';
				toast.error('Failed to update the integration');
				return;
			}
		}

		// TODO: Replace window.location.reload() with proper state reset
		window.location.reload();
	};

	state.testConnection = async () => {
		if (!state.dataSource || !state.isValidConfig()) {
			toast.error('Configuration is invalid');
			return false;
		}

		try {
			const formData = new FormData();
			formData.append('dataSourceId', state.dataSource.id);
			formData.append('integrationId', state.integration.id);

			const response = await fetch(window.location.pathname + '?/testConnection', {
				method: 'POST',
				body: formData
			});

			const result = await response.json();

			if (result.status === 200) {
				toast.info(result.data.message || 'Connection is successful!');
				return true;
			} else if (result.type === 'failure') {
				toast.error('Failed to validate connection');
				return false;
			}

			toast.error('Failed to validate connection');
			return false;
		} catch (error) {
			toast.error('Failed to test connection');
			return false;
		}
	};

	state.saveConfig = async (config: any) => {
		const isValid = state.isValidConfig(config);
		if (!isValid) {
			toast.error('Invalid configuration. Unable to save');
			return;
		}

		try {
			const formData = new FormData();
			formData.append('dataSourceId', state.dataSource?.id || '');
			formData.append('integrationId', state.integration.id);
			formData.append('config', JSON.stringify(config));

			const response = await fetch(window.location.pathname + '?/saveConfig', {
				method: 'POST',
				body: formData
			});

			const result = await response.json();

			if (result.type === 'success') {
				// Update local dataSource config
				if (state.dataSource) {
					state.dataSource.config = config;
				}
				toast.info(result.data?.message || 'Configuration saved successfully!');
			} else {
				toast.error(result.data?.message || 'Failed to save configuration');
			}
		} catch (error) {
			toast.error('Failed to save configuration');
		}
	};
}
