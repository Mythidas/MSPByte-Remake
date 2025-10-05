export interface BillingMetric {
	lastMonthCost: number;
	currentMonthCost: number;
	predictedMonthCost: number;
	billingBreakdown: {
		item: string;
		quantity: number;
		ratePerUnit: number;
		total: number;
	}[];
}

export interface SetupStatusData {
	isConnected: boolean;
	isEnabled: boolean;
	lastSyncedAt?: string;
	configurationComplete: boolean;
	errorMessage?: string;
}

export const mockBillingData: Record<string, BillingMetric> = {
	autotask: {
		lastMonthCost: 45.0,
		currentMonthCost: 38.0,
		predictedMonthCost: 50.0,
		billingBreakdown: [
			{
				item: 'Sites Mapped',
				quantity: 9,
				ratePerUnit: 2.0,
				total: 18.0
			},
			{
				item: 'Active Ticket Sync',
				quantity: 250,
				ratePerUnit: 0.05,
				total: 12.5
			},
			{
				item: 'Time Entry Sync',
				quantity: 150,
				ratePerUnit: 0.05,
				total: 7.5
			}
		]
	}
};

export const mockSetupStatus: Record<string, SetupStatusData> = {
	autotask: {
		isConnected: true,
		isEnabled: true,
		lastSyncedAt: '2025-10-04T14:32:00Z',
		configurationComplete: true
	}
};
