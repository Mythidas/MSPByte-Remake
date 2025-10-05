import type { Component } from 'svelte';
import SophosSiteMapping from './custom-tabs/SophosSiteMapping.svelte';

export interface IntegrationConfig {
	overview: {
		description: string;
		features: string[];
	};
	setup: {
		steps: string[];
		requirements?: string[];
	};
	troubleshooting: {
		title: string;
		solution: string;
	}[];
	customTabs?: {
		id: string;
		label: string;
		component?: Component; // For future custom components
	}[];
}

export const integrationConfigs: Record<string, IntegrationConfig> = {
	// Example: AutoTask
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
		],
		customTabs: [
			{
				id: 'site-mapping',
				label: 'Site Mapping'
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
		troubleshooting: [],
		customTabs: [
			{
				id: 'site-mapping',
				label: 'Site Mapping',
				component: SophosSiteMapping
			}
		]
	}
};
