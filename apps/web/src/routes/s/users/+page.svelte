<script lang="ts">
	import { api } from '$lib/convex';
	import DataTable from '$lib/components/table/DataTable.svelte';
	import { useQuery } from 'convex-svelte';

	// Use the infinite scrolling hook
	const table = useQuery(api.users.crud.list, {});
</script>

<div class="flex size-full flex-col gap-4">
	<h1 class="text-2xl">Users</h1>

	<DataTable
		rows={table.data || []}
		isLoading={table.isLoading}
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
