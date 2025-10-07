import { createClient } from '$lib/database/client.js';
import { ORM } from '$lib/database/orm.js';
import type { Tables } from '@workspace/shared/types/database/index.js';
import { getContext, setContext } from 'svelte';
import type { IntegrationState, IntegrationConfig } from './types.js';

export class IntegrationStateClass implements IntegrationState {
	orm: ORM;
	integration: Tables<'integrations'>;
	dataSource: Tables<'data_sources'> | undefined;
	tenantId: string;

	constructor(config: IntegrationConfig) {
		const supabase = createClient();
		this.orm = new ORM(supabase);
		this.integration = $state(config.integration);
		this.dataSource = $state(config.dataSource);
		this.tenantId = config.tenantId;
	}

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

	// Methods to be implemented in actions.ts
	enable = () => {};
	disable = () => {};
	confirmEnable = async () => {};
	confirmDisable = async () => {};
	testConnection = async () => false;
	saveConfig = async (config: any) => {};
}

const DEFAULT_KEY = Symbol('$integration');

export const getIntegration = (): IntegrationState => {
	return getContext<IntegrationState>(DEFAULT_KEY);
};

export const setIntegration = (config: IntegrationConfig): IntegrationState => {
	const state = new IntegrationStateClass(config);
	setContext<IntegrationState>(DEFAULT_KEY, state);
	return state;
};
