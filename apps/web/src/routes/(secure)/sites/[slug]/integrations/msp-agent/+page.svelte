<script lang="ts">
	import { api, type Doc } from '$lib/convex';
	import DataTable from '$lib/components/table/DataTable.svelte';
	import { getAppState } from '$lib/state/Application.svelte.js';
	import { type DataTableCell, type TableView } from '$lib/components/table/types.js';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
	import { useQuery } from 'convex-svelte';

	const appState = getAppState();

	// Define views for sites
	const views: TableView[] = [
		{
			name: 'online',
			label: 'Online Agents',
			description: 'Show only online agents',
			filters: [{ field: 'status', operator: 'eq', value: 'online' }]
		},
		{
			name: 'offline',
			label: 'Offline Agents',
			description: 'Show only offline agents',
			filters: [{ field: 'status', operator: 'eq', value: 'offline' }]
		}
	];

	// Track filters from table
	let dynamicFilters = $state<any>(undefined);

	// Query with dynamic filters from table
	const agentsQuery = useQuery(api.helpers.orm.list, () => {
		const siteId = appState.getSite()?._id;
		return {
			tableName: 'agents',
			filters: dynamicFilters,
			index: {
				name: 'by_site',
				params: { siteId: siteId! }
			}
		};
	});

	// Get unique versions from agents data
	const uniqueVersions = $derived.by(() => {
		const agents = agentsQuery.data || [];
		const versions = new Set<string>();

		for (const agent of agents) {
			if (agent.version) {
				versions.add(agent.version);
			}
		}

		return Array.from(versions)
			.sort()
			.map((version) => ({ label: version, value: version }));
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
		bind:filters={dynamicFilters}
		{views}
		columns={[
			{
				key: 'status',
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
				key: 'hostname',
				title: 'Hostname',
				sortable: true,
				searchable: true
			},
			{
				key: 'version',
				title: 'Version',
				type: 'string',
				searchable: true,
				sortable: true,
				filter: {
					component: 'select',
					operators: ['eq', 'ne'],
					defaultOperator: 'eq',
					options: uniqueVersions,
					placeholder: 'Select version'
				}
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
