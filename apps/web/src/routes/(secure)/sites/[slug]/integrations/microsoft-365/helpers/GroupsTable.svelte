<script lang="ts">
	import { api, type Doc } from '$lib/convex';
	import { useQuery } from 'convex-svelte';
	import DataTable from '$lib/components/table/DataTable.svelte';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { type DataTableCell } from '$lib/components/table/types.js';
	import { type Group } from '@workspace/database/convex/types/normalized.js';

	const { dataSourceId }: { dataSourceId: string } = $props();

	let filters = $state<any>(undefined);

	const groupsQuery = useQuery(api.helpers.orm.list, () => ({
		tableName: 'entities' as const,
		filters: filters,
		index: {
			name: 'by_data_source_type',
			params: {
				dataSourceId: dataSourceId,
				entityType: 'groups'
			}
		}
	}));
</script>

{#snippet typeSnip({ row }: DataTableCell<Doc<'entities'>>)}
	{@const group = row.normalizedData as Group}
	{@const type = group.type}
	{#if type === 'security'}
		<Badge variant="default" class="bg-chart-3">Security</Badge>
	{:else if type === 'distribution'}
		<Badge variant="default" class="bg-chart-1">Distribution</Badge>
	{:else if type === 'modern'}
		<Badge variant="default" class="bg-chart-2">Modern</Badge>
	{:else}
		<Badge variant="outline">{type.charAt(0).toUpperCase() + type.slice(1)}</Badge>
	{/if}
{/snippet}

<DataTable
	rows={groupsQuery.data || []}
	isLoading={groupsQuery.isLoading}
	bind:filters
	columns={[
		{
			key: 'normalizedData.name',
			title: 'Name',
			searchable: true,
			sortable: true,
			render: ({ row }) => (row.normalizedData as Group).name
		},
		{
			key: 'normalizedData.type',
			title: 'Type',
			sortable: true,
			cell: typeSnip,
			width: '150px',
			filter: {
				label: 'Type',
				component: 'select',
				operators: ['eq', 'ne'],
				defaultOperator: 'eq',
				options: [
					{ label: 'Security', value: 'security' },
					{ label: 'Distribution', value: 'distribution' },
					{ label: 'Modern', value: 'modern' },
					{ label: 'Custom', value: 'custom' }
				],
				placeholder: 'Select type'
			}
		},
		{
			key: 'normalizedData.description',
			title: 'Description',
			searchable: true,
			sortable: true,
			render: ({ row }) => (row.normalizedData as Group).description || 'N/A'
		},
		{
			key: 'normalizedData.created_at',
			title: 'Created',
			sortable: true,
			render: ({ row }) => {
				const createdAt = (row.normalizedData as Group).created_at;
				return createdAt ? new Date(createdAt).toLocaleDateString() : 'N/A';
			}
		}
	]}
/>
