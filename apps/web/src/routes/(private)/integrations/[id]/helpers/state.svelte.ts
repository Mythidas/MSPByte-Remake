import { createClient } from '$lib/database/client.js';
import { ORM } from '$lib/database/orm.js';
import { getConnector } from '@workspace/shared/lib/connectors/index.js';
import { CONSTANTS } from '@workspace/shared/lib/constants.js';
import type { Tables } from '@workspace/shared/types/database/index.js';
import { getContext, setContext } from 'svelte';
import { toast } from 'svelte-sonner';

interface IntegrationState {
	orm: ORM;
	integration?: Tables<'integrations'>;
	dataSource?: Tables<'data_sources'>;
	showEnableDialog: boolean;
	showDisableDialog: boolean;

	isEnabled: () => boolean;
	isValidConfig: (config?: any) => boolean;
	isConfigChanged: (config: any) => boolean;

	toggleEnabled: () => void;
	confirmEnable: () => Promise<void>;
	confirmDisable: () => Promise<void>;
	cancelDialog: () => void;

	testConnection: () => Promise<boolean>;
	saveConfig: (config: any) => Promise<void>;
}

export class IntegrationStateClass implements IntegrationState {
	orm: ORM;
	integration: Tables<'integrations'>;

	constructor(
		integration: Tables<'integrations'>,
		private tenantId: string
	) {
		const supabase = createClient();
		this.orm = new ORM(supabase);
		this.integration = $state(integration);
	}

	dataSource: Tables<'data_sources'> | undefined = $state(undefined);
	showEnableDialog = $state(false);
	showDisableDialog = $state(false);

	isEnabled = () => {
		return this.dataSource ? this.dataSource.status !== 'inactive' : false;
	};

	isValidConfig = (config?: any) => {
		if (!this.dataSource) return false;

		const configKeys = Object.entries(this.integration?.config_schema || {}).map(([key]) => key);
		const currentKeys = Object.entries(config || this.dataSource.config || {}).map(([key]) => key);

		return configKeys.every((key) => currentKeys.includes(key));
	};

	isConfigChanged = (config: any) => {
		return JSON.stringify(config) !== JSON.stringify(this.dataSource?.config as any);
	};

	toggleEnabled = () => {
		if (this.isEnabled()) {
			this.showDisableDialog = true;
		} else {
			this.showEnableDialog = true;
		}
	};

	confirmEnable = async () => {
		if (this.dataSource) {
			this.dataSource.status = 'active';

			const { error } = await this.orm.updateRow('data_sources', {
				id: this.dataSource.id,
				row: {
					status: 'active',
					deleted_at: null
				}
			});

			if (error) {
				this.dataSource.status = 'inactive';
				toast.error('Failed to update the integration');
			}
		} else {
			const { data } = await this.orm.insertRows('data_sources', {
				rows: [
					{
						tenant_id: this.tenantId,
						integration_id: this.integration.id,
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

			this.dataSource = data[0];
			toast.info('Enabled integration successfully!');
		}
		this.showEnableDialog = false;
	};

	confirmDisable = async () => {
		if (this.dataSource) {
			this.dataSource.status = 'inactive';

			const { error } = await this.orm.updateRow('data_sources', {
				id: this.dataSource.id,
				row: {
					status: 'inactive',
					deleted_at: new Date().toISOString()
				}
			});

			if (error) {
				this.dataSource.status = 'active';
				toast.error('Failed to update the integration');
			}
		}
		this.showDisableDialog = false;
	};

	cancelDialog = () => {
		this.showEnableDialog = false;
		this.showDisableDialog = false;
	};

	testConnection = async () => {
		if (!this.dataSource || !this.isValidConfig()) return false;

		const connector = getConnector(this.integration?.id! as any, this.dataSource?.config);
		if (!connector) return false;

		const { data, error } = await connector.checkHealth();
		if (error) {
			return false;
		}

		if (data) {
			toast.info('Connection is successful!');
			return true;
		}

		return false;
	};

	saveConfig = async (config: any) => {
		const isValid = this.isValidConfig(config);
		if (!isValid) {
			toast.error('Invalid configration. Unable to save');
			return;
		}

		const { error } = await this.orm.updateRow('data_sources', {
			id: this.dataSource?.id || '',
			row: {
				config
			}
		});

		if (error) {
			toast.error('Failed to save configuration');
			return;
		}

		toast.info('Configuration saved successfully!');
	};
}

const DEFAULT_KEY = Symbol('$integration_state');

export const getIntegrationState = (): IntegrationState => {
	return getContext<IntegrationState>(DEFAULT_KEY);
};

export const setIntegrationState = (
	integration: Tables<'integrations'>,
	tenantId: string
): IntegrationState => {
	const state = new IntegrationStateClass(integration, tenantId);
	setContext<IntegrationState>(DEFAULT_KEY, state);
	return state;
};
