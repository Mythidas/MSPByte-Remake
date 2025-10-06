<script lang="ts">
	import DataTable from '$lib/components/table/DataTable.svelte';
	import { createClient } from '$lib/database/client.js';
	import { ORM } from '$lib/database/orm.js';
</script>

<div class="flex size-full flex-col gap-4">
	<h1 class="text-2xl">Users</h1>

	<DataTable
		fetcher={async (state) => {
			const supabase = createClient();
			const orm = new ORM(supabase);

			const { data } = await orm.getRows('users_view', {
				pagination: state
			});

			return (
				data || {
					rows: [],
					total: 0
				}
			);
		}}
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
				key: 'role_name',
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
				key: 'last_activity_at',
				title: 'Last Active',
				render: ({ row }) =>
					row.last_last_activity_at ? new Date(row.last_activity_at).toDateString() : 'Never',
				hideable: true
			}
		]}
	/>
</div>
