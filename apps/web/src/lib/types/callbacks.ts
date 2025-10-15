export type M365ConsentCallback = {
	action: 'initial' | 'reconsent';
	tenantId: string;
	name: string;
	timestamp: number;
};
