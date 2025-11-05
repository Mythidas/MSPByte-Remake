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

	// Query all assigned_role relationships for this site to count role users
	const relationshipsQuery = useQuery(api.helpers.orm.list, () => ({
		tableName: 'entity_relationships' as const,
		index: {
			name: 'by_data_source_type',
			params: {
				dataSourceId: dataSourceId,
				relationshipType: 'assigned_role'
			}
		}
	}));

	// Create a map of role ID to user count
	const userCounts = $derived.by(() => {
		const relationships = relationshipsQuery.data || [];
		const counts = new Map<string, number>();

		relationships.forEach((rel: any) => {
			const roleId = rel.parentEntityId;
			counts.set(roleId, (counts.get(roleId) || 0) + 1);
		});

		return counts;
	});

	const tableData = $derived.by(() => {
		return (rolesQuery.data || []).map((role) => {
			const userCount = userCounts.get(role._id);
			return { ...role, userCount };
		});
	});
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

{#snippet userCountSnip({ row }: DataTableCell<Doc<'entities'>>)}
	{@const count = (row as any).userCount || 0}
	{@const role = row.normalizedData as Role}
	{@const isAdmin =
		role.name.toLowerCase().includes('admin') || role.name.toLowerCase().includes('global')}
	{#if count === 0}
		<Badge variant="destructive" class="text-xs">0</Badge>
	{:else if count > 10 && isAdmin}
		<Badge variant="secondary" class="bg-amber-500 text-xs text-white">{count}</Badge>
	{:else}
		<Badge class="bg-muted text-sm">{count}</Badge>
	{/if}
{/snippet}

<DataTable
	rows={tableData}
	isLoading={rolesQuery.isLoading}
	bind:filters
	filterFields={[
		{
			label: 'Name',
			key: 'normalizedData.name',
			config: {
				component: 'text',
				operators: ['contains'],
				placeholder: 'Search name'
			}
		},
		{
			label: 'Status',
			key: 'normalizedData.status',
			config: {
				component: 'select',
				operators: ['eq', 'ne'],
				defaultOperator: 'eq',
				options: [
					{ label: 'Enabled', value: 'enabled' },
					{ label: 'Disabled', value: 'disabled' }
				],
				placeholder: 'Select status'
			}
		},
		{
			label: 'Description',
			key: 'normalizedData.description',
			config: {
				component: 'text',
				operators: ['contains'],
				placeholder: 'Search description'
			}
		}
	]}
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
			key: 'userCount',
			title: 'Users',
			cell: userCountSnip,
			sortable: true,
			width: '100px',
			render: ({ row }) => String(userCounts.get(row._id) || 0)
		},
		{
			key: 'normalizedData.status',
			title: 'Status',
			sortable: true,
			cell: statusSnip,
			width: '120px'
		}
	]}
/>
