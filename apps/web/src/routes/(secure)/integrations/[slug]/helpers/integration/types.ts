import type { Doc } from '$lib/convex';

export interface IntegrationState {
    integration: Doc<'integrations'>;
    dataSource?: Doc<'data_sources'>;

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
    integration: Doc<'integrations'>;
    dataSource?: Doc<'data_sources'>;
}
