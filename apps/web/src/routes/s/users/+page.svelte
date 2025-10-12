<script lang="ts">
	import { api } from '$lib/convex';
	import DataTable from '$lib/components/table/DataTable.svelte';
	import Button from '$lib/components/ui/button/button.svelte';
	import { getAppState } from '$lib/state/Application.svelte.js';
	import { prettyText } from '@workspace/shared/lib/utils.js';
	import { useInfiniteConvexTable } from '$lib/hooks/useInfiniteConvexTable.svelte.js';

	const appState = getAppState();

	// Use the infinite scrolling hook
	const table = useInfiniteConvexTable({
		query: api.users.crud.paginate,
		baseArgs: {},
		numItems: 50
	});
</script>

<div class="flex size-full flex-col gap-4">
	<h1 class="text-2xl">Users</h1>

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
				key: 'email',
				title: 'Email',
				searchable: true
			},
			{
				key: 'roleName',
				title: 'Role',
				searchable: true
			},
			{
				key: 'status',
				title: 'Status',
				render({ row }) {
					return row.status[0].toUpperCase() + row.status.substring(1);
				}
			},
			{
				key: 'lastActivityAt',
				title: 'Last Active',
				render: ({ row }) =>
					row.last_last_activity_at ? new Date(row.last_activity_at).toDateString() : 'Never',
				hideable: true
			}
		]}
	/>
</div>
