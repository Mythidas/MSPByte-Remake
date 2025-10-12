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
		query: api.sites.crud.paginate,
		baseArgs: {},
		numItems: 50
	});
</script>

<div class="flex size-full flex-col gap-4 overflow-hidden">
	<h1 class="shrink-0 text-2xl">Sites</h1>

	{#snippet cellSnip({ row }: { row: any })}
		<Button
			href={`/s/sites/${row.slug}`}
			variant="link"
			class="p-0 text-primary-foreground hover:text-primary hover:no-underline"
			onclick={() => appState.setSite(row)}
		>
			{row.name}
		</Button>
	{/snippet}

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
