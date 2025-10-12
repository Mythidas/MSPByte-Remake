<script lang="ts">
	import { api } from '$lib/convex';
	import DataTable from '$lib/components/table/DataTable.svelte';
	import { getAppState } from '$lib/state/Application.svelte.js';
	import { useInfiniteConvexTable } from '$lib/hooks/useInfiniteConvexTable.svelte.js';

	const appState = getAppState();

	// Use the infinite scrolling hook
	const table = useInfiniteConvexTable({
		query: api.roles.crud.paginate,
		baseArgs: {
			includeGlobal: true
		},
		numItems: 50
	});
</script>

<div class="flex size-full flex-col gap-4">
	<h1 class="text-2xl">Roles</h1>

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
				key: 'name',
				title: 'Name',
				searchable: true
			},
			{
				key: 'description',
				title: 'Description',
				searchable: true
			},
			{
				key: 'tenantId',
				title: 'Pre-Defined',
				render: ({ row }) => (row.tenantId ? 'Custom' : 'System')
			}
		]}
	/>
</div>
