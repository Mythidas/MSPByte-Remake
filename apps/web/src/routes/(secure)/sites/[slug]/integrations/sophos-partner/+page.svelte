<script lang="ts">
	import { TabsList } from '$lib/components/ui/tabs';
	import RouteTabs from '$lib/components/tabs/RouteTabs.svelte';
	import RouteTabsContent from '$lib/components/tabs/RouteTabsContent.svelte';
	import RouteTabsTrigger from '$lib/components/tabs/RouteTabsTrigger.svelte';
	import OverviewTab from './helpers/OverviewTab.svelte';
	import EndpointsTable from './helpers/EndpointsTable.svelte';
	import FirewallsTable from './helpers/FirewallsTable.svelte';
	import LicensesTable from './helpers/LicensesTable.svelte';
	import type { PageData } from './$types.js';

	let { data }: { data: PageData } = $props();
	const dataSourceId = data.dataSource._id;
</script>

<div class="flex size-full flex-col gap-4">
	<h1 class="text-2xl">Sophos Partner</h1>

	<RouteTabs defaultTab="overview" class="flex size-full flex-col gap-4 overflow-hidden">
		<TabsList>
			<RouteTabsTrigger value="overview">Overview</RouteTabsTrigger>
			<RouteTabsTrigger value="endpoints">Endpoints</RouteTabsTrigger>
			<RouteTabsTrigger value="firewalls">Firewalls</RouteTabsTrigger>
			<RouteTabsTrigger value="licenses">Licenses</RouteTabsTrigger>
		</TabsList>

		<RouteTabsContent value="overview" class="flex flex-1 flex-col overflow-hidden">
			<OverviewTab dataSource={data.dataSource} />
		</RouteTabsContent>

		<RouteTabsContent value="endpoints" class="flex flex-1 flex-col overflow-hidden">
			<EndpointsTable {dataSourceId} />
		</RouteTabsContent>

		<RouteTabsContent value="firewalls" class="flex flex-1 flex-col overflow-hidden">
			<FirewallsTable {dataSourceId} />
		</RouteTabsContent>

		<RouteTabsContent value="licenses" class="flex flex-1 flex-col overflow-hidden">
			<LicensesTable {dataSourceId} />
		</RouteTabsContent>
	</RouteTabs>
</div>
