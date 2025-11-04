<script lang="ts">
	import { api, type Doc } from '$lib/convex';
	import { useQuery } from 'convex-svelte';
	import DataTable from '$lib/components/table/DataTable.svelte';
	import { type DataTableCell } from '$lib/components/table/types.js';
	import { Progress } from '$lib/components/ui/progress/index.js';
	import { type License } from '@workspace/database/convex/types/normalized.js';

	const { dataSourceId }: { dataSourceId: string } = $props();

	let filters = $state<any>(undefined);

	const licensesQuery = useQuery(api.helpers.orm.list, () => ({
		tableName: 'entities' as const,
		filters: filters,
		index: {
			name: 'by_data_source_type',
			params: {
				dataSourceId: dataSourceId,
				entityType: 'licenses'
			}
		}
	}));
</script>

{#snippet utilizationSnip({ row }: DataTableCell<Doc<'entities'>>)}
	{@const license = row.normalizedData as License}
	{@const consumed = license.consumedUnits || 0}
	{@const total = license.totalUnits || 0}
	{@const percentage =
		total > 0 ? Math.round((consumed / total) * 100) : consumed > total ? -100 : 0}
	<div class="flex items-center gap-2">
		{#if percentage >= 0}
			<div class="w-24">
				<Progress value={percentage} class="h-2" />
			</div>
			<span class="text-sm">{percentage}%</span>
		{:else}
			<div class="w-24">
				<Progress value={100} bgColor="bg-red-500" />
			</div>
			<span>Overused</span>
		{/if}
	</div>
{/snippet}

<DataTable
	rows={licensesQuery.data || []}
	isLoading={licensesQuery.isLoading}
	bind:filters
	columns={[
		{
			key: 'normalizedData.name',
			title: 'Name',
			searchable: true,
			sortable: true,
			render: ({ row }) => (row.normalizedData as License).name
		},
		{
			key: 'normalizedData.skuPartNumber',
			title: 'SKU',
			searchable: true,
			sortable: true,
			render: ({ row }) => (row.normalizedData as License).skuPartNumber
		},
		{
			key: 'normalizedData.totalUnits',
			title: 'Total',
			sortable: true,
			render: ({ row }) => (row.normalizedData as License).totalUnits?.toString() || '0',
			width: '100px'
		},
		{
			key: 'normalizedData.consumedUnits',
			title: 'Consumed',
			sortable: true,
			render: ({ row }) => (row.normalizedData as License).consumedUnits?.toString() || '0',
			width: '120px'
		},
		{
			key: 'utilization',
			title: 'Utilization',
			sortable: true,
			cell: utilizationSnip,
			width: '180px'
		}
	]}
/>
