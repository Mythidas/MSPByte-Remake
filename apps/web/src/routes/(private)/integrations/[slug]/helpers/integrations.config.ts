import type { Component } from 'svelte';
import SophosSiteMapping from './custom-tabs/SophosSiteMapping.svelte';
import MSPAgentConfig from './custom-tabs/MSPAgentConfig.svelte';
import HaloPSASiteMapping from './custom-tabs/HaloPSASiteMapping.svelte';
import type { Tables } from '@workspace/shared/types/database/index.js';
import type { IntegrationState } from './integration/types.js';

export type IntegrationBillingData = {
	lastMonth: number;
	currentMonth: number;
	yearly: number;
	breakdown: {
		label: string;
		unitCost: number;
		units: number;
		total: number;
	}[];
};

export interface IntegrationConfig {
	overview: {
		description: string;
		features: string[];
	};
	setup: {
		steps: string[];
		requirements?: string[];
	};
	troubleshooting?: {
		title: string;
		solution: string;
	}[];
	configuration?: Component;
	customTabs?: {
		id: string;
		label: string;
		component: Component; // For future custom components
	}[];

	getBillingData?: (integration: IntegrationState) => Promise<IntegrationBillingData>;
}

export const integrationConfigs: Record<string, IntegrationConfig> = {
	autotask: {
		overview: {
			description:
				'Sync your AutoTask PSA with MSPByte for seamless ticket management, time tracking, and billing integration.',
			features: ['Site and company mapping']
		},
		setup: {
			requirements: [
				'AutoTask API credentials (Username and API Key)',
				'Admin access to your AutoTask instance',
				'AutoTask API access enabled'
			],
			steps: [
				'Log in to your AutoTask admin portal',
				'Navigate to Admin > Resources/Users and create a new API user',
				'Generate an API integration key',
				'Enter your AutoTask instance URL, username, and API key in the Configuration tab',
				'Click "Test Connection" to verify credentials',
				'Save the configration & enable the integration',
				'Map AutoTask sites to MSP Byte sites in the "Site Mapping" tab'
			]
		},
		troubleshooting: [
			{
				title: 'Connection fails with 401 Unauthorized',
				solution:
					'Verify your API credentials are correct and that the API user has proper permissions in AutoTask.'
			},
			{
				title: 'Sites not appearing in mapping',
				solution:
					'Ensure the API user has access to all companies/sites you want to sync. Check AutoTask security level settings.'
			}
		]
	},
	halopsa: {
		overview: {
			description: 'Sync your AutoTask PSA with MSPByte for site syncing',
			features: ['Site Mapping', 'MSP Agent Integration']
		},
		setup: {
			requirements: [
				'Admin access to your HaloPSA portal',
				'HaloPSA API credentials (Client ID and Secret)'
			],
			steps: [
				'Log in to your HaloPSA portal',
				'Navigate to Configuration > Integrations > HaloPSA API',
				'View Applications and create a new application',
				'Select Client ID and Secret',
				'Choose "Login Type" as Agent and log in as can be any user',
				'Set Permissions as "all:standard" and save the user',
				'(Optional) Set the CORS whitelist to mspbyte.pro',
				'Save the info in the "Configuration" tab and then Test Connection',
				'Map or Create MSP Byte sites from the "Site Mapping" tab'
			]
		},
		customTabs: [
			{
				id: 'site-mapping',
				label: 'Site Mapping',
				component: HaloPSASiteMapping
			}
		]
	},
	'sophos-partner': {
		overview: {
			description:
				'Sync your Sophos Partner Tenant with MSPByte for insights on agents, firewalls, licenses and customer health',
			features: [
				'Site mapping',
				'Endpoint syncing',
				'Firewall syncing',
				'License syncing',
				'Health information'
			]
		},
		setup: {
			requirements: [
				'Admin access to your Sophos Partner portal',
				'Sophos Partner API credentials (Username and API Key)'
			],
			steps: [
				'Log in to your SophosPartner portal',
				'Navigate to Admin > Resources/Users and create a new API user',
				'Generate an API integration key',
				'WIP'
			]
		},
		customTabs: [
			{
				id: 'site-mapping',
				label: 'Site Mapping',
				component: SophosSiteMapping
			}
		]
	},
	'msp-agent': {
		overview: {
			description:
				'Provide an installable agent to allow ticket submission from customer endpoints to the configured PSA',
			features: ['Installable Agent', 'PSA Ticket Submission', 'Per Agent Ticket Logs']
		},
		setup: {
			requirements: [],
			steps: []
		},
		configuration: MSPAgentConfig,
		troubleshooting: []
	}
};
