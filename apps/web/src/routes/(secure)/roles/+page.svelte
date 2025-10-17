<script lang="ts">
	import { api } from '$lib/convex';
	import DataTable from '$lib/components/table/DataTable.svelte';
	import { useQuery } from 'convex-svelte';

	// Use the infinite scrolling hook
	const table = useQuery(api.roles.crud.list, {});
	const global = useQuery(api.roles.query.getGlobal, {});

	const data = $derived([...(table.data || []), ...(global.data || [])]);
</script>

<div class="flex size-full flex-col gap-4">
	<h1 class="text-2xl">Roles</h1>

	<DataTable
		rows={data}
		isLoading={table.isLoading || global.isLoading}
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
