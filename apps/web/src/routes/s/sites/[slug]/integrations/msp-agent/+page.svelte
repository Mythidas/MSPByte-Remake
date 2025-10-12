<script lang="ts">
	import { api, type Doc } from '$lib/convex';
	import DataTable from '$lib/components/table/DataTable.svelte';
	import { getAppState } from '$lib/state/Application.svelte.js';
	import { useInfiniteConvexTable } from '$lib/hooks/useInfiniteConvexTable.svelte.js';
	import { Dates } from '$lib/Dates.js';
	import { type DataTableCell } from '$lib/components/table/types.js';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
	import { onMount, onDestroy } from 'svelte';

	const appState = getAppState();

	// Use the infinite scrolling hook
	const table = useInfiniteConvexTable({
		query: api.agents.crud.paginate,
		baseArgs: {},
		numItems: 50
	});

	let currentTime = $state(Date.now());
	let intervalId: ReturnType<typeof setInterval> | undefined;

	onMount(() => {
		intervalId = setInterval(() => {
			currentTime = Date.now();
		}, 30000); // Update every 30 seconds
	});

	onDestroy(() => {
		if (intervalId) clearInterval(intervalId);
	});
</script>

<div class="flex size-full flex-col gap-4">
	<h1 class="text-2xl">Agents</h1>

	{#snippet onlineSnip({ row }: DataTableCell<Doc<'agents'>>)}
		{@const minutesAgo3 = currentTime - 3 * 60 * 1000}
		{@const lastCheckin = new Date(row.lastCheckinAt || '').getTime()}
		<Tooltip.Provider>
			<Tooltip.Root>
				<Tooltip.Trigger>
					{#if lastCheckin >= minutesAgo3}
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
