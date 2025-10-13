<script lang="ts">
	import { api, type Doc } from '$lib/convex';
	import DataTable from '$lib/components/table/DataTable.svelte';
	import { getAppState } from '$lib/state/Application.svelte.js';
	import { type DataTableCell } from '$lib/components/table/types.js';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
	import { useQuery } from 'convex-svelte';

	const appState = getAppState();

	const agentsQuery = useQuery(api.agents.crud.list, () => {
		const siteId = appState.getSite()?._id;
		return { filters: { siteId } };
	});
</script>

<div class="flex size-full flex-col gap-4">
	<h1 class="text-2xl">Agents</h1>

	{#snippet statusSnip({ row }: DataTableCell<Doc<'agents'>>)}
		{@const status = row.status || 'unknown'}
		{@const lastCheckin = row.statusChangedAt
			? new Date(row.statusChangedAt).toLocaleString()
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

	<DataTable
		rows={agentsQuery.data || []}
		isLoading={agentsQuery.isLoading}
		columns={[
			{
				key: 'status',
				title: '',
				sortable: true,
				cell: statusSnip,
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
				searchable: true,
				sortable: true
			},
			{
				key: 'ipAddress',
				title: 'IPv4',
				searchable: true,
				hideable: true
			},
			{
				key: 'extAddress',
				title: 'WAN',
				searchable: true,
				hideable: true
			}
		]}
	/>
</div>
