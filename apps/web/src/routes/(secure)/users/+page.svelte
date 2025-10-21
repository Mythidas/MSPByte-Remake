<script lang="ts">
	import { api, type Doc } from '$lib/convex';
	import DataTable from '$lib/components/table/DataTable.svelte';
	import { useQuery } from 'convex-svelte';

	// Track filters from table
	let dynamicFilters = $state<any>(undefined);

	// Query with dynamic filters from table
	const table = useQuery(api.helpers.orm.list, () => ({
		tableName: 'users',
		filters: dynamicFilters
	}));
	const rolesQuery = useQuery(api.helpers.orm.list, () => ({
		tableName: 'roles'
	}));
	const globalQuery = useQuery(api.roles.query.getGlobal, {});
	const roles = $derived([
		...((rolesQuery.data as Doc<'roles'>[]) || []),
		...((globalQuery.data as Doc<'roles'>[]) || [])
	]);
</script>

<div class="flex size-full flex-col gap-4">
	<h1 class="text-2xl">Users</h1>

	<DataTable
		rows={table.data || []}
		isLoading={table.isLoading}
		bind:filters={dynamicFilters}
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
				searchable: true,
				render: ({ row }) => roles.find((r) => r._id === row.roleId)?.name || 'Unknown'
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
