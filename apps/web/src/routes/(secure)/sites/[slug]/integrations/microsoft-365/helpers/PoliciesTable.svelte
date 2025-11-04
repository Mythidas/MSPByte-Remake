<script lang="ts">
	import { api, type Doc } from '$lib/convex';
	import { useQuery } from 'convex-svelte';
	import DataTable from '$lib/components/table/DataTable.svelte';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { type DataTableCell } from '$lib/components/table/types.js';
	import { type Policy } from '@workspace/database/convex/types/normalized.js';

	const { dataSourceId }: { dataSourceId: string } = $props();

	let filters = $state<any>(undefined);

	const policiesQuery = useQuery(api.helpers.orm.list, () => ({
		tableName: 'entities' as const,
		filters: filters,
		index: {
			name: 'by_data_source_type',
			params: {
				dataSourceId: dataSourceId,
				entityType: 'policies'
			}
		}
	}));
</script>

{#snippet statusSnip({ row }: DataTableCell<Doc<'entities'>>)}
	{@const policy = row.normalizedData as Policy}
	{@const status = policy.status}
	{#if status === 'enabled'}
		<Badge variant="default" class="bg-chart-1">Enabled</Badge>
	{:else if status === 'disabled'}
		<Badge variant="secondary">Disabled</Badge>
	{:else if status === 'report-only'}
		<Badge variant="outline" class="bg-amber-500 text-white">Report Only</Badge>
	{/if}
{/snippet}

<DataTable
	rows={policiesQuery.data || []}
	isLoading={policiesQuery.isLoading}
	bind:filters
	columns={[
		{
			key: 'normalizedData.name',
			title: 'Name',
			searchable: true,
			sortable: true,
			render: ({ row }) => (row.normalizedData as Policy).name
		},
		{
			key: 'normalizedData.description',
			title: 'Description',
			searchable: true,
			sortable: true,
			render: ({ row }) => (row.normalizedData as Policy).description || 'N/A'
		},
		{
			key: 'normalizedData.status',
			title: 'Status',
			sortable: true,
			cell: statusSnip,
			width: '150px',
			filter: {
				label: 'Status',
				component: 'select',
				operators: ['eq', 'ne'],
				defaultOperator: 'eq',
				options: [
					{ label: 'Enabled', value: 'enabled' },
					{ label: 'Disabled', value: 'disabled' },
					{ label: 'Report Only', value: 'report-only' }
				],
				placeholder: 'Select status'
			}
		},
		{
			key: 'normalizedData.createdAt',
			title: 'Created',
			sortable: true,
			render: ({ row }) => {
				const createdAt = (row.normalizedData as Policy).createdAt;
				return createdAt ? new Date(createdAt).toLocaleDateString() : 'N/A';
			}
		}
	]}
/>
