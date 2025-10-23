<script lang="ts">
	import { api, type Doc } from '$lib/convex';
	import { useQuery } from 'convex-svelte';
	import { getAppState } from '$lib/state/Application.svelte.js';
	import { Tabs, TabsContent, TabsList, TabsTrigger } from '$lib/components/ui/tabs';
	import EndpointsTable from './helpers/EndpointsTable.svelte';
	import FirewallsTable from './helpers/FirewallsTable.svelte';

	const appState = getAppState();

	// Track filters from endpoint table
	let endpointFilters = $state<any>(undefined);

	// Track filters from firewall table
	let firewallFilters = $state<any>(undefined);

	// Query endpoints with dynamic filters from table
	const endpointsTable = useQuery(api.helpers.orm.list, () => ({
		tableName: 'entities' as const,
		filters: endpointFilters,
		index: {
			name: 'by_site_type',
			params: {
				siteId: appState.getSite()?._id!,
				entityType: 'endpoints'
			}
		}
	}));

	// Query firewalls with dynamic filters from table
	const firewallsTable = useQuery(api.helpers.orm.list, () => ({
		tableName: 'entities' as const,
		filters: firewallFilters,
		index: {
			name: 'by_site_type',
			params: {
				siteId: appState.getSite()?._id!,
				entityType: 'firewalls'
			}
		}
	}));

	$inspect(firewallsTable.data);
</script>

<div class="flex size-full flex-col gap-4">
	<h1 class="text-2xl">Sophos Partner</h1>

	<Tabs value="endpoints" class="flex size-full flex-col gap-4 overflow-hidden">
		<TabsList>
			<TabsTrigger value="endpoints">Endpoints</TabsTrigger>
			<TabsTrigger value="firewalls">Firewalls</TabsTrigger>
		</TabsList>

		<TabsContent value="endpoints" class="flex flex-1 flex-col overflow-hidden">
			<EndpointsTable
				data={endpointsTable.data as Doc<'entities'>[]}
				isLoading={endpointsTable.isLoading}
				bind:filters={endpointFilters}
			/>
		</TabsContent>

		<TabsContent value="firewalls" class="flex flex-1 flex-col overflow-hidden">
			<FirewallsTable
				data={firewallsTable.data as Doc<'entities'>[]}
				isLoading={firewallsTable.isLoading}
				bind:filters={firewallFilters}
			/>
		</TabsContent>
	</Tabs>
</div>
