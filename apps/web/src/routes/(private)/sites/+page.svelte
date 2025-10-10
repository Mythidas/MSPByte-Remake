<script lang="ts">
	import { api } from '$lib/convex';
	import { type SiteWithDetails } from '@workspace/database/convex/types.js';
	import DataTable from '$lib/components/table/DataTable.svelte';
	import { type DataTableCell } from '$lib/components/table/types.js';
	import Button from '$lib/components/ui/button/button.svelte';
	import { getAppState } from '$lib/state/Application.svelte.js';
	import { prettyText } from '@workspace/shared/lib/utils.js';

	const appState = getAppState();
</script>

<div class="flex size-full flex-col gap-4 overflow-hidden">
	<h1 class="shrink-0 text-2xl">Sites</h1>

	{#snippet cellSnip({ row }: DataTableCell<SiteWithDetails>)}
		<Button
			href={`/sites/${row.slug}`}
			variant="link"
			class="p-0 text-primary-foreground hover:text-primary hover:no-underline"
			onclick={() => appState.setSite(row as any)}
		>
			{row.name}
		</Button>
	{/snippet}

	<DataTable
		fetcher={async (state) => {
			const result = await appState.convex.query(api.sites.getSites, {
				page: state.page ?? 0,
				pageSize: state.size ?? 100,
				search: state.globalSearch,
				sorting: state.sorting || { name: 'asc' }
			});

			return result;
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
				key: 'psaIntegrationName',
				title: 'PSA',
				searchable: false,
				sortable: false,
				render: ({ row }) => prettyText(row.psaIntegrationName)
			},
			{
				key: 'psaCompanyId',
				title: 'PSA ID',
				hideable: true,
				sortable: true
			}
		]}
	/>
</div>
