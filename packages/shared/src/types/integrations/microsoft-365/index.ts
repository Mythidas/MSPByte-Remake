export type Microsoft365IntegrationConfig = {
    permissionVersion: number;
};

export type Microsoft365DataSourceConfig = {
    name: string;
    tenantId: string;
    tenantName: string;
    domainMappings: {
        domain: string;
        siteId: string;
    }[];
    availableDomains: {
        name: string;
        isDefault: boolean;
        userCount: number;
    }[];
    permissionVersion: number;
};

export * from './consent';
