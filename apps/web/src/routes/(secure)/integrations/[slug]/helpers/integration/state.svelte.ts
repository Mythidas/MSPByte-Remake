import { getContext, setContext } from 'svelte';
import type { IntegrationState, IntegrationConfig } from './types.js';
import type { Doc } from '$lib/convex';

export class IntegrationStateClass implements IntegrationState {
	integration: Doc<'integrations'>;
	dataSource?: Doc<'data_sources'>;

	constructor(config: IntegrationConfig) {
		this.integration = $state(config.integration);
		this.dataSource = $state(config.dataSource);
	}

	isEnabled = () => {
		return this.dataSource ? this.dataSource.status !== 'inactive' : false;
	};

	isValidConfig = (config?: any) => {
		if (!this.dataSource) return false;

		const configKeys = Object.entries(this.integration?.configSchema || {}).map(([key]) => key);
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
