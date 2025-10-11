<script lang="ts">
	import DataTable from "$lib/components/table/DataTable.svelte";
	import { type DataTableCell } from "$lib/components/table/types.js";
	import { Dates } from "$lib/Dates.js";
	import { getAppState } from "$lib/state/Application.svelte.js";
	import { type Tables } from "@workspace/shared/types/database/index.js";

  const appState = getAppState();
</script>

<div class="flex size-full flex-col gap-4">
	<h1 class="text-2xl">Users</h1>

  {#snippet onlineSnip({ row }: DataTableCell<Tables<'agents'>>)}
    {@const minutesAgo3 = new Dates().add({ minutes: -3 }).getTime()}
    {#if minutesAgo3 <= new Date(row.last_checkin_at || '').getTime()}
      <div class="rounded-full bg-chart-1 w-4 h-4"></div>
    {:else}
      <div class="rounded-full bg-destructive w-4 h-4"></div>
    {/if}
  {/snippet}

	<DataTable
		fetcher={async (state) => {
			const { data } = await appState.orm.getRows('agents', {
        filters: [['site_id', 'eq', appState.getSite()!.id]],
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
				key: 'hostname',
				title: 'Hostname',
        sortable: true,
				searchable: true
			},
			{
				key: 'version',
				title: 'Version',
        sortable: true,
				searchable: true
			},
			{
				key: 'ip_address',
				title: 'IPv4',
				searchable: true,
        sortable: true,
        hideable: true
			},
			{
				key: 'ext_address',
				title: 'WAN',
        searchable: true,
        sortable: true,
        hideable: true
			},
			{
				key: 'last_checkin_at',
				title: 'Last Active',
        hideable: true,
        sortable: true,
        cell: onlineSnip
			}
		]}
	/>
</div>
