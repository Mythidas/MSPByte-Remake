<script lang="ts">
	import { api, type Doc } from '$lib/convex';
	import { useQuery } from 'convex-svelte';
	import { getAppState } from '$lib/state/Application.svelte.js';
	import DataTable from '$lib/components/table/DataTable.svelte';
	import { type DataTableCell, type TableView } from '$lib/components/table/types.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { type License } from '@workspace/database/convex/types/normalized.js';
	import { AlertTriangle, ShieldAlert, Users, Key, CheckCircle, PauseCircle } from 'lucide-svelte';
	import AlertDetailSheet from './AlertDetailSheet.svelte';

	const { dataSourceId }: { dataSourceId: string } = $props();

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
			filters: [{ field: 'status', operator: 'eq', value: 'active' }]
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
			icon: AlertTriangle,
			filters: [{ field: 'severity', operator: 'eq', value: 'critical' }]
		}
	];

	// Query alerts
	const alertsQuery = useQuery(api.helpers.orm.list, () => ({
		tableName: 'entity_alerts' as const,
		filters: filters,
		index: {
			name: 'by_site',
			params: {
				siteId: appState.getSite()?._id
			}
		}
	}));
	const alerts = $derived((alertsQuery.data || []) as Doc<'entity_alerts'>[]);

	// Query identities for stats (site-level)
	const identitiesQuery = useQuery(api.helpers.orm.list, () => ({
		tableName: 'entities' as const,
		index: {
			name: 'by_site_type',
			params: {
				siteId: appState.getSite()?._id!,
				entityType: 'identities'
			}
		}
	}));

	// Query licenses for stats (data source-level)
	const licensesQuery = useQuery(api.helpers.orm.list, () => ({
		tableName: 'entities' as const,
		index: {
			name: 'by_data_source_type',
			params: {
				dataSourceId: dataSourceId,
				entityType: 'licenses'
			}
		}
	}));
	const licenses = $derived((licensesQuery.data || []) as Doc<'entities'>[]);

	// Calculate stats
	const stats = $derived({
		totalIdentities: identitiesQuery.data?.length || 0,
		activeAlerts: alerts.filter((a) => a.status === 'active').length || 0,
		criticalAlerts:
			alerts.filter((a) => a.status === 'active' && a.severity === 'critical').length || 0,
		highAlerts: alerts.filter((a) => a.status === 'active' && a.severity === 'high').length || 0,
		totalLicenses:
			licenses.reduce((acc, l) => {
				const license = l.normalizedData as License;
				return acc + (license.totalUnits || 0);
			}, 0) || 0,
		consumedLicenses:
			licenses.reduce((acc, l) => {
				const license = l.normalizedData as License;
				return acc + (license.consumedUnits || 0);
			}, 0) || 0
	});

	const isLoading = $derived(
		alertsQuery.isLoading || identitiesQuery.isLoading || licensesQuery.isLoading
	);
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

<div class="flex size-full flex-col gap-4 overflow-auto">
	<!-- Stats Cards -->
	<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
		<Card.Root>
			<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
				<Card.Title class="text-sm font-medium">Identities</Card.Title>
				<Users class="text-muted-foreground h-4 w-4" />
			</Card.Header>
			<Card.Content>
				<div class="text-2xl font-bold">{stats.totalIdentities}</div>
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
				<Card.Title class="text-sm font-medium">Active Alerts</Card.Title>
				<AlertTriangle class="text-muted-foreground h-4 w-4" />
			</Card.Header>
			<Card.Content>
				<div class="text-2xl font-bold">{stats.activeAlerts}</div>
				<p class="text-muted-foreground text-xs">
					{stats.criticalAlerts} critical, {stats.highAlerts} high
				</p>
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
				<Card.Title class="text-sm font-medium">License Usage</Card.Title>
				<Key class="text-muted-foreground h-4 w-4" />
			</Card.Header>
			<Card.Content>
				<div class="text-2xl font-bold">{stats.consumedLicenses} / {stats.totalLicenses}</div>
				<p class="text-muted-foreground text-xs">
					{stats.totalLicenses > 0
						? Math.round((stats.consumedLicenses / stats.totalLicenses) * 100)
						: 0}% utilized
				</p>
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
				<Card.Title class="text-sm font-medium">Critical Issues</Card.Title>
				<ShieldAlert class="text-destructive h-4 w-4" />
			</Card.Header>
			<Card.Content>
				<div class="text-destructive text-2xl font-bold">{stats.criticalAlerts}</div>
				<p class="text-muted-foreground text-xs">Require immediate attention</p>
			</Card.Content>
		</Card.Root>
	</div>

	<!-- Alerts Table -->
	<div class="flex flex-1 flex-col overflow-hidden">
		<h2 class="mb-2 text-lg font-semibold">Recent Alerts</h2>
		<DataTable
			rows={alertsQuery.data || []}
			{isLoading}
			bind:filters
			views={alertViews}
			onRowClick={(alert) => {
				selectedAlert = alert;
				sheetOpen = true;
			}}
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
					cell: alertTypeSnip,
					filter: {
						label: 'Alert Type',
						component: 'select',
						operators: ['eq', 'ne'],
						defaultOperator: 'eq',
						options: [
							{ label: 'MFA Not Enforced', value: 'mfa_not_enforced' },
							{ label: 'Stale User', value: 'stale_user' },
							{ label: 'License Waste', value: 'license_waste' },
							{ label: 'Policy Gap', value: 'policy_gap' }
						],
						placeholder: 'Select type'
					}
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
				},
				{
					key: 'updatedAt',
					title: 'Updated',
					sortable: true,
					render: ({ row }) => new Date(row.updatedAt).toLocaleString()
				}
			]}
		/>
	</div>

	<!-- Alert Detail Sheet -->
	<AlertDetailSheet
		alert={selectedAlert}
		bind:open={sheetOpen}
		onClose={() => {
			selectedAlert = null;
			sheetOpen = false;
		}}
	/>
</div>
