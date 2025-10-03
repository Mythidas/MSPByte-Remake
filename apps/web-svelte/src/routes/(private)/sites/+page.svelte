<script lang="ts">
	import DataTable from '$lib/components/table/DataTable.svelte';
	import { createClient } from '$lib/database/client.js';
	import { ORM } from '$lib/database/orm.js';
	import { prettyText } from '$shared/lib/utils.js';
</script>

<div class="flex size-full flex-col gap-4 overflow-hidden">
	<h1 class="shrink-0 text-2xl">Sites</h1>

	<DataTable
		fetcher={async (state) => {
			const supabase = createClient();
			const orm = new ORM(supabase);

			const { data } = await orm.getRows('sites_view', {
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
				key: 'parent_name',
				title: 'Parent',
				searchable: true
			},
			{
				key: 'psa_integration_id',
				title: 'PSA',
				render: ({ row }) => prettyText(row.psa_integration_id)
			},
			{
				key: 'psa_company_id',
				title: 'PSA ID'
			}
		]}
	/>
</div>
