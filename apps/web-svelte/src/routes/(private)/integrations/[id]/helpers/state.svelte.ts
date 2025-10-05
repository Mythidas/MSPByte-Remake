import { createClient } from '$lib/database/client.js';
import { ORM } from '$lib/database/orm.js';
import { getConnector } from '@workspace/shared/lib/connectors/index.js';
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
	isValidConfig: () => boolean;

	toggleEnabled: () => void;
	confirmEnable: () => Promise<void>;
	confirmDisable: () => Promise<void>;
	cancelDialog: () => void;

	testConnection: () => Promise<boolean>;
}

export class IntegrationStateClass implements IntegrationState {
	orm: ORM;

	constructor() {
		const supabase = createClient();
		this.orm = new ORM(supabase);
	}

	integration: Tables<'integrations'> | undefined = $state(undefined);
	dataSource: Tables<'data_sources'> | undefined = $state(undefined);
	showEnableDialog = $state(false);
	showDisableDialog = $state(false);

	isEnabled = () => {
		return this.dataSource ? this.dataSource.status !== 'inactive' : false;
	};

	isValidConfig = () => {
		if (!this.dataSource) return false;

		const configKeys = Object.entries(this.integration?.config_schema || {}).map(([key]) => key);
		const currentKeys = Object.entries(this.dataSource.config || {}).map(([key]) => key);

		return configKeys.every((key) => currentKeys.includes(key));
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
}

const DEFAULT_KEY = Symbol('$integration_state');

export const getIntegrationState = (): IntegrationState => {
	return getContext<IntegrationState>(DEFAULT_KEY);
};

export const setIntegrationState = (): IntegrationState => {
	const state = new IntegrationStateClass();
	setContext<IntegrationState>(DEFAULT_KEY, state);
	return state;
};
