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

	// Query all member_of relationships for this site to count group members
	const relationshipsQuery = useQuery(api.helpers.orm.list, () => ({
		tableName: 'entity_relationships' as const,
		index: {
			name: 'by_data_source_type',
			params: {
				dataSourceId: dataSourceId,
				relationshipType: 'member_of'
			}
		}
	}));

	// Create a map of group ID to member count
	const memberCounts = $derived.by(() => {
		const relationships = relationshipsQuery.data || [];
		const counts = new Map<string, number>();

		relationships.forEach((rel: any) => {
			const groupId = rel.parentEntityId;
			counts.set(groupId, (counts.get(groupId) || 0) + 1);
		});

		return counts;
	});

	const tableData = $derived.by(() => {
		return (groupsQuery.data || []).map((role) => {
			const memberCount = memberCounts.get(role._id);
			return { ...role, memberCount };
		});
	});
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

{#snippet memberCountSnip({ row }: DataTableCell<Doc<'entities'>>)}
	{@const count = (row as any).memberCount || 0}
	{#if count === 0}
		<Badge variant="destructive" class="text-xs">0</Badge>
	{:else}
		<Badge class="bg-muted text-sm">{count}</Badge>
	{/if}
{/snippet}

<DataTable
	rows={tableData}
	isLoading={groupsQuery.isLoading}
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
			label: 'Type',
			key: 'normalizedData.type',
			config: {
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
			label: 'Description',
			key: 'normalizedData.description',
			config: {
				component: 'text',
				operators: ['contains'],
				placeholder: 'Search description'
			}
		},
		{
			key: 'normalizedData.created_at',
			label: 'Created',
			config: {
				component: 'date',
				operators: ['gte', 'lte'],
				placeholder: 'Select date'
			}
		}
	]}
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
			width: '150px'
		},

		{
			key: 'normalizedData.description',
			title: 'Description',
			searchable: true,
			sortable: true,
			render: ({ row }) => (row.normalizedData as Group).description || 'N/A'
		},
		{
			key: 'memberCount',
			title: 'Members',
			cell: memberCountSnip,
			sortable: true,
			width: '100px',
			render: ({ row }) => String(memberCounts.get(row._id) || 0)
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
