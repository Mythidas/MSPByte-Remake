<script lang="ts">
	import DataTable from '$lib/components/table/DataTable.svelte';
	import { type DataTableCell } from '$lib/components/table/types.js';
	import Button from '$lib/components/ui/button/button.svelte';
	import { createClient } from '$lib/database/client.js';
	import { ORM } from '$lib/database/orm.js';
	import { getAppState } from '$lib/state/Application.svelte.js';
	import { prettyText } from '$shared/lib/utils.js';
	import { type Tables } from '@workspace/shared/types/database/index.js';

	const appState = getAppState();
</script>

<div class="flex size-full flex-col gap-4 overflow-hidden">
	<h1 class="shrink-0 text-2xl">Sites</h1>

	{#snippet cellSnip({ row }: DataTableCell<Tables<'sites_view'>>)}
		<Button
			href={`/sites/${row.slug}`}
			variant="link"
			class="p-0 text-primary-foreground hover:text-primary hover:no-underline"
			onclick={() => appState.setSite(row)}
		>
			{row.name}
		</Button>
	{/snippet}

	<DataTable
		fetcher={async (state) => {
			const supabase = createClient();
			const orm = new ORM(supabase);

			state.sorting = state.sorting || { name: 'asc' };

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
				searchable: true,
				sortable: true,
				cell: cellSnip
			},
			{
				key: 'parent_name',
				title: 'Parent',
				searchable: true,
				sortable: true
			},
			{
				key: 'psa_integration_id',
				title: 'PSA',
				render: ({ row }) => prettyText(row.psa_integration_id)
			},
			{
				key: 'psa_company_id',
				title: 'PSA ID',
				hideable: true,
				sortable: true
			}
		]}
	/>
</div>
