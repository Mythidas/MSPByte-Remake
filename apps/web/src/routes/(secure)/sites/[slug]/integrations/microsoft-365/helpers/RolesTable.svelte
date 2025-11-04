<script lang="ts">
	import { api, type Doc } from '$lib/convex';
	import { useQuery } from 'convex-svelte';
	import DataTable from '$lib/components/table/DataTable.svelte';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { type DataTableCell } from '$lib/components/table/types.js';
	import { type Role } from '@workspace/database/convex/types/normalized.js';

	const { dataSourceId }: { dataSourceId: string } = $props();

	let filters = $state<any>(undefined);

	const rolesQuery = useQuery(api.helpers.orm.list, () => ({
		tableName: 'entities' as const,
		filters: filters,
		index: {
			name: 'by_data_source_type',
			params: {
				dataSourceId: dataSourceId,
				entityType: 'roles'
			}
		}
	}));
</script>

{#snippet statusSnip({ row }: DataTableCell<Doc<'entities'>>)}
	{@const role = row.normalizedData as Role}
	{@const status = role.status}
	{#if status === 'enabled'}
		<Badge variant="default" class="bg-chart-1">Enabled</Badge>
	{:else}
		<Badge variant="secondary">Disabled</Badge>
	{/if}
{/snippet}

<DataTable
	rows={rolesQuery.data || []}
	isLoading={rolesQuery.isLoading}
	bind:filters
	columns={[
		{
			key: 'normalizedData.name',
			title: 'Name',
			searchable: true,
			sortable: true,
			render: ({ row }) => (row.normalizedData as Role).name
		},
		{
			key: 'normalizedData.description',
			title: 'Description',
			searchable: true,
			sortable: true,
			render: ({ row }) => (row.normalizedData as Role).description || 'N/A'
		},
		{
			key: 'normalizedData.status',
			title: 'Status',
			sortable: true,
			cell: statusSnip,
			width: '120px',
			filter: {
				label: 'Status',
				component: 'select',
				operators: ['eq', 'ne'],
				defaultOperator: 'eq',
				options: [
					{ label: 'Enabled', value: 'enabled' },
					{ label: 'Disabled', value: 'disabled' }
				],
				placeholder: 'Select status'
			}
		}
	]}
/>
