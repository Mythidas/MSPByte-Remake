<script lang="ts">
	import { api } from '$lib/convex';
	import DataTable from '$lib/components/table/DataTable.svelte';
	import Button from '$lib/components/ui/button/button.svelte';
	import { getAppState } from '$lib/state/Application.svelte.js';
	import { prettyText } from '@workspace/shared/lib/utils.js';
	import { useQuery } from 'convex-svelte';
	import { type TableView } from '$lib/components/table/types.js';

	const appState = getAppState();

	// Define views for sites
	const siteViews: TableView[] = [
		{
			name: 'active',
			label: 'Active Sites',
			description: 'Show only active sites',
			filters: [{ field: 'status', operator: 'eq', value: 'active' }]
		},
		{
			name: 'inactive',
			label: 'Inactive Sites',
			description: 'Show only inactive sites',
			filters: [{ field: 'status', operator: 'eq', value: 'inactive' }]
		},
		{
			name: 'no-psa',
			label: 'Missing PSA',
			description: 'Sites without PSA integration',
			filters: [{ field: 'psaIntegrationId', operator: 'eq', value: null }]
		}
	];

	// Track filters from table
	let dynamicFilters = $state<any>(undefined);

	// Query with dynamic filters from table
	const table = useQuery(api.helpers.orm.list, () => ({
		tableName: 'sites',
		filters: dynamicFilters
	}));

	$inspect(dynamicFilters);
</script>

<div class="flex size-full flex-col gap-4 overflow-hidden">
	<h1 class="shrink-0 text-2xl">Sites</h1>

	{#snippet cellSnip({ row }: { row: any })}
		<Button
			href={`/sites/${row.slug}`}
			variant="link"
			class="p-0 text-primary-foreground hover:text-primary hover:no-underline"
			onclick={() => appState.setSite(row)}
		>
			{row.name}
		</Button>
	{/snippet}

	<DataTable
		rows={table.data || []}
		isLoading={table.isLoading}
		views={siteViews}
		bind:filters={dynamicFilters}
		columns={[
			{
				key: 'name',
				title: 'Name',
				type: 'string',
				searchable: true,
				sortable: true,
				cell: cellSnip,
				filter: {
					component: 'text',
					operators: ['eq', 'ne', 'contains', 'startsWith', 'endsWith'],
					defaultOperator: 'contains',
					placeholder: 'Enter site name'
				}
			},
			{
				key: 'status',
				title: 'Status',
				type: 'string',
				searchable: true,
				sortable: true,
				render: ({ row }) => prettyText(row.status),
				filter: {
					component: 'select',
					operators: ['eq', 'ne'],
					defaultOperator: 'eq',
					options: [
						{ label: 'Active', value: 'active' },
						{ label: 'Inactive', value: 'inactive' }
					]
				}
			},
			{
				key: 'psaIntegrationName',
				title: 'PSA',
				type: 'string',
				searchable: true,
				sortable: true,
				render: ({ row }) => prettyText(row.psaIntegrationName),
				filter: {
					component: 'text',
					operators: ['eq', 'ne', 'contains'],
					defaultOperator: 'contains',
					placeholder: 'Enter PSA name'
				}
			},
			{
				key: 'psaCompanyId',
				title: 'PSA ID',
				type: 'string',
				hideable: true,
				sortable: true,
				filter: {
					component: 'text',
					operators: ['eq', 'ne'],
					defaultOperator: 'eq',
					placeholder: 'Enter PSA ID'
				}
			}
		]}
	/>
</div>
