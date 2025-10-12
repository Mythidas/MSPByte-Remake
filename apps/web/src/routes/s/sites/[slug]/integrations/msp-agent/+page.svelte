<script lang="ts">
	import { api, type Doc } from '$lib/convex';
	import DataTable from '$lib/components/table/DataTable.svelte';
	import { getAppState } from '$lib/state/Application.svelte.js';
	import { useInfiniteConvexTable } from '$lib/hooks/useInfiniteConvexTable.svelte.js';
	import { Dates } from '$lib/Dates.js';
	import { type DataTableCell } from '$lib/components/table/types.js';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';

	const appState = getAppState();

	// Use the infinite scrolling hook
	const table = useInfiniteConvexTable({
		query: api.agents.crud.paginate,
		baseArgs: {},
		numItems: 50
	});
</script>

<div class="flex size-full flex-col gap-4">
	<h1 class="text-2xl">Agents</h1>

	{#snippet onlineSnip({ row }: DataTableCell<Doc<'agents'>>)}
		{@const minutesAgo3 = new Dates().add({ minutes: -3 }).getTime()}
		<Tooltip.Provider>
			<Tooltip.Root>
				<Tooltip.Trigger>
					{#if minutesAgo3 <= new Date(row.lastCheckinAt || '').getTime()}
						<div class="h-4 w-4 rounded-full bg-chart-1"></div>
					{:else}
						<div class="h-4 w-4 rounded-full bg-destructive"></div>
					{/if}
				</Tooltip.Trigger>
				<Tooltip.Content>
					{new Date(row.lastCheckinAt || '').toLocaleString()}
				</Tooltip.Content>
			</Tooltip.Root>
		</Tooltip.Provider>
	{/snippet}

	<DataTable
		rows={table.rows}
		isLoading={table.isLoading}
		isDone={table.isDone}
		onLoadMore={table.loadMore}
		onSearch={table.setSearch}
		onSort={table.setSort}
		rowHeight={48}
		columns={[
			{
				key: 'lastCheckinAt',
				title: '',
				hideable: true,
				sortable: true,
				cell: onlineSnip,
				width: '48px'
			},
			{
				key: 'hostname',
				title: 'Hostname',
				sortable: true,
				searchable: true
			},
			{
				key: 'version',
				title: 'Version',
				sortable: true,
				searchable: true
			},
			{
				key: 'ipAddress',
				title: 'IPv4',
				searchable: true,
				sortable: true,
				hideable: true
			},
			{
				key: 'extAddress',
				title: 'WAN',
				searchable: true,
				sortable: true,
				hideable: true
			}
		]}
	/>
</div>
