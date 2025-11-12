<script lang="ts">
	import { api, type Doc } from '$lib/convex';
	import { useQuery } from 'convex-svelte';
	import { getAppState } from '$lib/state/Application.svelte.js';
	import DataTable from '$lib/components/table/DataTable.svelte';
	import { type DataTableCell } from '$lib/components/table/types.js';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
	import { type Endpoint } from '@workspace/database/convex/types/normalized.js';
	import { prettyText } from '@workspace/shared/lib/utils.js';
	import { CircleArrowUp } from 'lucide-svelte';

	const { dataSourceId }: { dataSourceId: string } = $props();
	const appState = getAppState();

	let filters = $state<any>(undefined);

	// Query endpoints with dynamic filters from table
	const endpointsQuery = useQuery(api.helpers.orm.list, () => ({
		tableName: 'entities' as const,
		filters: filters,
		index: {
			name: 'by_site_type',
			params: {
				siteId: appState.getSite()?._id!,
				entityType: 'endpoints'
			}
		}
	}));

	const data = $derived((endpointsQuery.data || []) as Doc<'entities'>[]);
	const isLoading = $derived(endpointsQuery.isLoading);
</script>

{#snippet statusSnip({ row }: DataTableCell<Doc<'entities'>>)}
	{@const data = row.normalizedData as Endpoint}
	{@const status = data.status || 'unknown'}
	{@const lastCheckin = data.last_check_in
		? new Date(data.last_check_in).toLocaleString()
		: 'Never'}
	<Tooltip.Provider>
		<Tooltip.Root>
			<Tooltip.Trigger>
				{#if status === 'online'}
					<div class="h-4 w-4 rounded-full bg-chart-1" title="Online"></div>
				{:else if status === 'offline'}
					<div class="h-4 w-4 rounded-full bg-destructive" title="Offline"></div>
				{:else}
					<div class="h-4 w-4 rounded-full bg-muted" title="Unknown"></div>
				{/if}
			</Tooltip.Trigger>
			<Tooltip.Content>
				<div class="flex flex-col gap-1">
					<div class="font-semibold capitalize">{status}</div>
					<div class="text-xs">Last updated: {lastCheckin}</div>
				</div>
			</Tooltip.Content>
		</Tooltip.Root>
	</Tooltip.Provider>
{/snippet}

{#snippet versionSnip({ row }: DataTableCell<Doc<'entities'>>)}
	{@const data = row.rawData as any}
	<span class="flex items-center gap-2">
		{prettyText(data.packages.protection.name)}
		{#if data.packages.protection.status === 'upgradable'}
			<CircleArrowUp class="w-4 text-amber-500" />
		{/if}
	</span>
{/snippet}

<DataTable
	rows={data || []}
	{isLoading}
	bind:filters
	columns={[
		{
			key: 'normalizedData.status',
			title: '',
			sortable: true,
			cell: statusSnip,
			width: '48px',
			filter: {
				label: 'Status',
				component: 'select',
				operators: ['eq', 'ne'],
				defaultOperator: 'eq',
				options: [
					{ label: 'Online', value: 'online' },
					{ label: 'Offline', value: 'offline' },
					{ label: 'Unknown', value: null }
				],
				placeholder: 'Select status'
			}
		},
		{
			key: 'normalizedData.hostname',
			title: 'Hostname',
			searchable: true,
			sortable: true,
			render: ({ row }) => (row.normalizedData as any).hostname
		},
		{
			key: 'normalizedData.os',
			title: 'OS',
			searchable: true,
			sortable: true,
			render: ({ row }) => (row.normalizedData as any).os
		},
		{
			key: 'normalizedData.ip_address',
			title: 'IPv4',
			searchable: true,
			sortable: true,
			render: ({ row }) => (row.normalizedData as any).ip_address
		},
		{
			key: 'rawData.packages.protection.name',
			title: 'Version',
			sortable: true,
			cell: versionSnip
		},
		{
			key: 'rawData.tamperProtectionEnabled',
			title: 'TP',
			sortable: true,
			render: ({ row }) => ((row.rawData as any)?.tamperProtectionEnabled ? 'Enabled' : 'Disabled')
		},
		{
			key: 'rawData.health.overall',
			title: 'Health',
			sortable: true,
			render: ({ row }) => prettyText((row.rawData as any).health.overall)
		},
		{
			key: 'normalizedData.last_check_in',
			title: 'Last Checkin',
			sortable: true,
			render: ({ row }) => new Date((row.normalizedData as any).last_check_in).toLocaleDateString()
		}
	]}
/>
