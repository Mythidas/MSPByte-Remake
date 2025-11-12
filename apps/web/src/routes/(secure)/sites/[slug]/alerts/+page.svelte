<script lang="ts">
	import { api, type Doc } from '$lib/convex';
	import { useQuery } from 'convex-svelte';
	import DataTable from '$lib/components/table/DataTable.svelte';
	import { type DataTableCell, type TableView } from '$lib/components/table/types.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button';
	import AlertTriangleIcon from 'lucide-svelte/icons/alert-triangle';
	import CheckCircleIcon from 'lucide-svelte/icons/check-circle';
	import PauseIcon from 'lucide-svelte/icons/pause';
	import ShieldAlertIcon from 'lucide-svelte/icons/shield-alert';
	import AlertDetailSheet from '../integrations/microsoft-365/helpers/AlertDetailSheet.svelte';

	const { data } = $props();

	let filters = $state<any | undefined>(undefined);
	let selectedAlert = $state<any | null>(null);
	let sheetOpen = $state(false);
	const site = data.site;

	// Predefined alert views
	const alertViews: TableView[] = [
		{
			name: 'active',
			label: 'Active Alerts',
			description: 'Currently active and unresolved alerts across all sites',
			icon: AlertTriangleIcon,
			filters: [{ field: 'status', operator: 'eq', value: 'active' }],
			isDefault: true
		},
		{
			name: 'critical',
			label: 'Critical Issues',
			description: 'All critical severity alerts',
			icon: ShieldAlertIcon,
			filters: [
				{ field: 'severity', operator: 'eq', value: 'critical' },
				{ field: 'status', operator: 'eq', value: 'active' }
			]
		},
		{
			name: 'high',
			label: 'High Priority',
			description: 'High severity active alerts',
			icon: AlertTriangleIcon,
			filters: [
				{ field: 'severity', operator: 'eq', value: 'high' },
				{ field: 'status', operator: 'eq', value: 'active' }
			]
		},
		{
			name: 'suppressed',
			label: 'Suppressed Alerts',
			description: 'Alerts that have been suppressed or snoozed',
			icon: PauseIcon,
			filters: [{ field: 'status', operator: 'eq', value: 'suppressed' }]
		},
		{
			name: 'resolved',
			label: 'Resolved Alerts',
			description: 'Alerts that have been resolved or addressed',
			icon: CheckCircleIcon,
			filters: [{ field: 'status', operator: 'eq', value: 'resolved' }]
		}
	];

	// Query all tenant alerts using standard ORM
	const alertsQuery = useQuery(api.helpers.orm.list, () => ({
		tableName: 'entity_alerts' as const,
		filters: filters,
		index: {
			name: 'by_site' as const,
			params: {
				siteId: site._id
			}
		}
	}));

	const alerts = $derived((alertsQuery.data || []) as Doc<'entity_alerts'>[]);
	const isLoading = $derived(alertsQuery.isLoading);
</script>

{#snippet siteSnip({ row }: DataTableCell<any>)}
	{#if row.siteSlug}
		<div class="flex flex-col">
			<Button
				href={`/sites/${row.siteSlug}`}
				variant="link"
				class="h-auto w-full items-start justify-start p-0 text-start font-normal"
				onclick={(e) => {
					e.stopPropagation();
				}}
			>
				{row.siteName}
			</Button>
		</div>
	{:else}
		<span class="text-muted-foreground">{row.siteName}</span>
	{/if}
{/snippet}

{#snippet severitySnip({ row }: DataTableCell<any>)}
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

{#snippet alertTypeSnip({ row }: DataTableCell<any>)}
	{@const type = row.alertType}
	{@const formatted = type
		.split('_')
		.map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(' ')}
	<span class="capitalize">{formatted}</span>
{/snippet}

{#snippet statusSnip({ row }: DataTableCell<any>)}
	{@const status = row.status}
	{#if status === 'active'}
		<Badge variant="default">Active</Badge>
	{:else if status === 'resolved'}
		<Badge variant="secondary">Resolved</Badge>
	{:else if status === 'suppressed'}
		<Badge variant="outline">Suppressed</Badge>
	{/if}
{/snippet}

<div class="flex size-full flex-col gap-4 overflow-hidden p-6">
	<div>
		<h1 class="text-2xl font-bold">All Alerts</h1>
		<p class="text-muted-foreground">Monitor alerts across all sites in your tenant</p>
	</div>

	<div class="flex flex-1 flex-col overflow-hidden">
		{#if alerts.length === 0 && !isLoading}
			<div class="flex flex-1 items-center justify-center">
				<div class="text-center">
					<CheckCircleIcon class="text-muted-foreground/50 mx-auto mb-4 h-16 w-16" />
					<h3 class="text-muted-foreground mb-2 text-lg font-medium">No alerts found</h3>
					<p class="text-muted-foreground text-sm">
						There are no alerts matching your current filters.
					</p>
				</div>
			</div>
		{:else}
			<DataTable
				rows={alerts}
				columns={[
					{
						key: 'alertType',
						title: 'Type',
						sortable: true,
						cell: alertTypeSnip,
						filter: {
							component: 'text',
							operators: ['eq', 'ne', 'contains'],
							defaultOperator: 'contains'
						}
					},
					{
						key: 'message',
						title: 'Message',
						sortable: false,
						searchable: true,
						filter: {
							component: 'text',
							operators: ['contains'],
							defaultOperator: 'contains'
						}
					},
					{
						key: 'severity',
						title: 'Severity',
						sortable: true,
						cell: severitySnip,
						filter: {
							component: 'select',
							operators: ['eq', 'ne', 'in', 'nin'],
							defaultOperator: 'eq',
							options: [
								{ label: 'Critical', value: 'critical' },
								{ label: 'High', value: 'high' },
								{ label: 'Medium', value: 'medium' },
								{ label: 'Low', value: 'low' }
							]
						}
					},
					{
						key: 'status',
						title: 'Status',
						sortable: true,
						cell: statusSnip,
						filter: {
							component: 'select',
							operators: ['eq', 'ne', 'in', 'nin'],
							defaultOperator: 'eq',
							options: [
								{ label: 'Active', value: 'active' },
								{ label: 'Resolved', value: 'resolved' },
								{ label: 'Suppressed', value: 'suppressed' }
							]
						}
					},
					{
						key: 'integrationSlug',
						title: 'Integration',
						sortable: true,
						render: ({ row }: any) => row.integrationSlug || 'Unknown',
						filter: {
							component: 'text',
							operators: ['eq', 'ne', 'contains'],
							defaultOperator: 'contains'
						}
					},
					{
						key: 'updatedAt',
						title: 'Last Updated',
						sortable: true,
						render: ({ row }: any) => {
							const date = new Date(row.updatedAt);
							return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
						}
					}
				]}
				{isLoading}
				bind:filters
				views={alertViews}
				onRowClick={(row) => {
					selectedAlert = row;
					sheetOpen = true;
				}}
			/>
		{/if}
	</div>
</div>

<!-- Alert Detail Sheet -->
{#if selectedAlert}
	<AlertDetailSheet bind:open={sheetOpen} alert={selectedAlert} />
{/if}
