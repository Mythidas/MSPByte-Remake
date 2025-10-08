<script lang="ts">
	import DataTable from '$lib/components/table/DataTable.svelte';
	import { getAppState } from "$lib/state/Application.svelte.js";

	const appState = getAppState();
</script>

<div class="flex size-full flex-col gap-4">
	<h1 class="text-2xl">Roles</h1>

	<DataTable
		fetcher={async (state) => {
			const { data } = await appState.orm.getRows('roles', {
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
				key: 'description',
				title: 'Description',
				searchable: true
			},
			{
				key: 'tenant_id',
				title: 'Pre-Defined',
				render: ({ row }) => (row.tenant_id ? 'Custom' : 'System')
			},
			{
				key: 'created_at',
				title: 'Created At',
				render: ({ row }) => new Date(row.created_at).toDateString(),
				hideable: true
			}
		]}
	/>
</div>
