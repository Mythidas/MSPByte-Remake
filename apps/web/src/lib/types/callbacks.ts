export type M365ConsentCallback = {
    action: 'initial' | 'reconsent';
    tenantId: string;
    dataSourceId: string;
    name: string;
    timestamp: number;
};
