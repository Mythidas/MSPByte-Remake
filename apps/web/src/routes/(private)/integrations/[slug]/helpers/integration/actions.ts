import { CONSTANTS } from '@workspace/shared/lib/constants.js';
import { toast } from 'svelte-sonner';
import type { IntegrationState } from './types.js';
import { getAppState } from '$lib/state/Application.svelte.js';
import { api } from '$lib/convex';

export function createIntegrationActions(state: IntegrationState) {
	const appState = getAppState();

	state.enable = () => {
		// Trigger enable dialog in component
	};

	state.disable = () => {
		// Trigger disable dialog in component
	};

	state.confirmEnable = async () => {
		if (state.dataSource) {
			const enable = appState.convex.mutation(api.datasources.mutate.enable, {
				id: state.dataSource._id
			});

			if (!enable) {
				state.dataSource.status = 'inactive';
				toast.error('Failed to update the integration');
				return;
			}
		} else {
			const data = await appState.convex.mutation(
				api.datasources.mutate.createPrimaryForIntegration,
				{
					integrationId: state.integration._id
				}
			);

			if (!data) {
				toast.error('Failed to enabled integration');
				return;
			}

			state.dataSource = data;
			toast.info('Enabled integration successfully!');
		}

		await appState.convex.mutation(api.scheduledjobs.mutate.scheduleJobsByIntegration, {
			integrationId: state.integration._id,
			dataSourceId: state.dataSource?._id,
			supportedTypes: state.integration.supportedTypes
		});
	};

	state.confirmDisable = async () => {
		if (state.dataSource) {
			const disable = await appState.convex.mutation(api.datasources.mutate.disable, {
				id: state.dataSource._id
			});

			if (!disable) {
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
			formData.append('dataSourceId', state.dataSource._id);
			formData.append('integrationId', state.integration._id);

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
			formData.append('dataSourceId', state.dataSource?._id || '');
			formData.append('integrationId', state.integration._id);
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
