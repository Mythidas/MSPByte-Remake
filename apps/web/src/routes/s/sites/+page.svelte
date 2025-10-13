<script lang="ts">
	import { api } from '$lib/convex';
	import DataTable from '$lib/components/table/DataTable.svelte';
	import Button from '$lib/components/ui/button/button.svelte';
	import { getAppState } from '$lib/state/Application.svelte.js';
	import { prettyText } from '@workspace/shared/lib/utils.js';
	import { useQuery } from 'convex-svelte';

	const appState = getAppState();

	// Use the URL-state-enabled table hook
	const table = useQuery(api.sites.crud.list, {});
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
		rows={table.data || []}
		isLoading={table.isLoading}
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
				searchable: true,
				sortable: true,
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
