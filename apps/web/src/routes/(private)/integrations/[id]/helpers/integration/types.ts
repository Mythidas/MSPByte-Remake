import type { ORM } from '$lib/database/orm.js';
import type { Tables } from '@workspace/shared/types/database/index.js';

export interface IntegrationState {
	orm: ORM;
	integration: Tables<'integrations'>;
	dataSource?: Tables<'data_sources'>;
	tenantId: string;

	isEnabled: () => boolean;
	isValidConfig: (config?: any) => boolean;
	isConfigChanged: (config: any) => boolean;

	enable: () => void;
	disable: () => void;
	confirmEnable: () => Promise<void>;
	confirmDisable: () => Promise<void>;

	testConnection: () => Promise<boolean>;
	saveConfig: (config: any) => Promise<void>;
}

export interface IntegrationConfig {
	integration: Tables<'integrations'>;
	dataSource?: Tables<'data_sources'>;
	tenantId: string;
}
