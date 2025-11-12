<script lang="ts">
	import { api, type Doc } from '$lib/convex';
	import { useQuery } from 'convex-svelte';
	import { getAppState } from '$lib/state/Application.svelte.js';
	import DataTable from '$lib/components/table/DataTable.svelte';
	import { type DataTableCell, type TableView } from '$lib/components/table/types.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import {
		AlertTriangle,
		ShieldAlert,
		HardDrive,
		Laptop,
		CheckCircle,
		PauseCircle
	} from 'lucide-svelte';
	import AlertDetailSheet from './AlertDetailSheet.svelte';

	const { dataSource }: { dataSource: Doc<'data_sources'> } = $props();
	const appState = getAppState();

	let filters = $state<any>({ status: 'active' }); // Show only active alerts by default
	let selectedAlert = $state<Doc<'entity_alerts'> | null>(null);
	let sheetOpen = $state(false);

	// Predefined alert views
	const alertViews: TableView[] = [
		{
			name: 'active',
			label: 'Active Alerts',
			description: 'Currently active and unresolved alerts',
			icon: AlertTriangle,
			filters: [{ field: 'status', operator: 'eq', value: 'active' }],
			isDefault: true
		},
		{
			name: 'suppressed',
			label: 'Suppressed Alerts',
			description: 'Alerts that have been suppressed or snoozed',
			icon: PauseCircle,
			filters: [{ field: 'status', operator: 'eq', value: 'suppressed' }]
		},
		{
			name: 'resolved',
			label: 'Resolved Alerts',
			description: 'Alerts that have been resolved or addressed',
			icon: CheckCircle,
			filters: [{ field: 'status', operator: 'eq', value: 'resolved' }]
		},
		{
			name: 'critical',
			label: 'Critical Issues',
			description: 'All critical severity alerts regardless of status',
			icon: ShieldAlert,
			filters: [{ field: 'severity', operator: 'eq', value: 'critical' }]
		}
	];

	// Query alerts
	const alertsQuery = useQuery(api.helpers.orm.list, () => ({
		tableName: 'entity_alerts' as const,
		filters: filters,
		index: {
			name: 'by_site_integration',
			params: {
				siteId: appState.getSite()?._id,
				integrationId: dataSource.integrationId
			}
		}
	}));
	const alerts = $derived((alertsQuery.data || []) as Doc<'entity_alerts'>[]);

	// Query firewalls for stats
	const firewallsQuery = useQuery(api.helpers.orm.list, () => ({
		tableName: 'entities' as const,
		index: {
			name: 'by_site_type',
			params: {
				siteId: appState.getSite()?._id!,
				entityType: 'firewalls'
			}
		}
	}));
	const firewalls = $derived((firewallsQuery.data || []) as Doc<'entities'>[]);

	// Query endpoints for stats
	const endpointsQuery = useQuery(api.helpers.orm.list, () => ({
		tableName: 'entities' as const,
		index: {
			name: 'by_site_type',
			params: {
				siteId: appState.getSite()?._id!,
				entityType: 'endpoints'
			}
		}
	}));
	const endpoints = $derived((endpointsQuery.data || []) as Doc<'entities'>[]);

	// Calculate stats
	const stats = $derived({
		totalFirewalls: firewalls.length || 0,
		totalEndpoints: endpoints.length || 0,
		// Firmware compliance: count firewalls that don't have upgradeAvailable set to true
		firmwareCompliance:
			firewalls.length > 0
				? Math.round(
						(firewalls.filter((f) => !f.rawData.firmware?.newestFirmware).length /
							firewalls.length) *
							100
					)
				: 0,
		// Endpoints needing updates: count endpoints with protectionUpgradable set to true
		endpointsPendingUpdate:
			endpoints.filter((e) => e.rawData?.packages?.protection?.status === 'upgradable').length || 0,
		activeAlerts: alerts.filter((a) => a.status === 'active').length || 0,
		criticalAlerts:
			alerts.filter((a) => a.status === 'active' && a.severity === 'critical').length || 0
	});

	const isLoading = $derived(
		alertsQuery.isLoading || firewallsQuery.isLoading || endpointsQuery.isLoading
	);

	function handleRowClick(alert: Doc<'entity_alerts'>) {
		selectedAlert = alert;
		sheetOpen = true;
	}
</script>

{#snippet severitySnip({ row }: DataTableCell<Doc<'entity_alerts'>>)}
	{@const severity = row.severity}
	{#if severity === 'critical'}
		<Badge variant="destructive">Critical</Badge>
	{:else if severity === 'high'}
		<Badge variant="destructive" class="bg-orange-500">High</Badge>
	{:else if severity === 'medium'}
		<Badge variant="secondary" class="bg-amber-500 text-white">Medium</Badge>
	{:else}
		<Badge variant="outline">Low</Badge>
	{/if}
{/snippet}

{#snippet alertTypeSnip({ row }: DataTableCell<Doc<'entity_alerts'>>)}
	{@const type = row.alertType}
	{@const formatted = type
		.split('_')
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(' ')}
	<span class="capitalize">{formatted}</span>
{/snippet}

<div class="flex flex-col gap-6">
	<!-- Statistics Cards -->
	<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
		<Card.Root>
			<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
				<Card.Title class="text-sm font-medium">Total Firewalls</Card.Title>
				<HardDrive class="text-muted-foreground h-4 w-4" />
			</Card.Header>
			<Card.Content>
				<div class="text-2xl font-bold">{stats.totalFirewalls}</div>
				<p class="text-muted-foreground text-xs">Across this site</p>
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
				<Card.Title class="text-sm font-medium">Total Endpoints</Card.Title>
				<Laptop class="text-muted-foreground h-4 w-4" />
			</Card.Header>
			<Card.Content>
				<div class="text-2xl font-bold">{stats.totalEndpoints}</div>
				<p class="text-muted-foreground text-xs">Protected devices</p>
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
				<Card.Title class="text-sm font-medium">Firmware Compliance</Card.Title>
				<CheckCircle class="text-muted-foreground h-4 w-4" />
			</Card.Header>
			<Card.Content>
				<div class="text-2xl font-bold">{stats.firmwareCompliance}%</div>
				<p class="text-muted-foreground text-xs">Firewalls up to date</p>
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
				<Card.Title class="text-sm font-medium">Endpoints Pending Update</Card.Title>
				<AlertTriangle class="text-muted-foreground h-4 w-4" />
			</Card.Header>
			<Card.Content>
				<div class="text-2xl font-bold">{stats.endpointsPendingUpdate}</div>
				<p class="text-muted-foreground text-xs">Agents needing updates</p>
			</Card.Content>
		</Card.Root>
	</div>

	<div class="flex flex-1 flex-col overflow-hidden">
		<h2 class="mb-2 text-lg font-semibold">Recent Alerts</h2>
		{#if alerts.length === 0}
			<div class="text-muted-foreground flex flex-col items-center justify-center py-12">
				<CheckCircle class="mb-4 h-12 w-12" />
				<p class="text-lg font-medium">No alerts found</p>
				<p class="text-sm">All systems are operating normally</p>
			</div>
		{:else}
			<DataTable
				rows={alertsQuery.data || []}
				{isLoading}
				bind:filters
				views={alertViews}
				onRowClick={handleRowClick}
				columns={[
					{
						key: 'severity',
						title: 'Severity',
						sortable: true,
						cell: severitySnip,
						width: '120px',
						filter: {
							label: 'Severity',
							component: 'select',
							operators: ['eq', 'ne'],
							defaultOperator: 'eq',
							options: [
								{ label: 'Critical', value: 'critical' },
								{ label: 'High', value: 'high' },
								{ label: 'Medium', value: 'medium' },
								{ label: 'Low', value: 'low' }
							],
							placeholder: 'Select severity'
						}
					},
					{
						key: 'alertType',
						title: 'Type',
						sortable: true,
						cell: alertTypeSnip
					},
					{
						key: 'message',
						title: 'Message',
						searchable: true,
						sortable: true,
						render: ({ row }) => row.message
					},
					{
						key: 'status',
						title: 'Status',
						sortable: true,
						render: ({ row }) => row.status.charAt(0).toUpperCase() + row.status.slice(1),
						filter: {
							label: 'Status',
							component: 'select',
							operators: ['eq', 'ne'],
							defaultOperator: 'eq',
							options: [
								{ label: 'Active', value: 'active' },
								{ label: 'Resolved', value: 'resolved' },
								{ label: 'Suppressed', value: 'suppressed' }
							],
							placeholder: 'Select status'
						}
					}
				]}
			/>
		{/if}
	</div>
</div>

{#if selectedAlert}
	<AlertDetailSheet bind:open={sheetOpen} alert={selectedAlert} />
{/if}
