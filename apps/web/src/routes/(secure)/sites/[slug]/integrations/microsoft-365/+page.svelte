<script lang="ts">
	import { TabsList } from '$lib/components/ui/tabs';
	import RouteTabs from '$lib/components/tabs/RouteTabs.svelte';
	import RouteTabsContent from '$lib/components/tabs/RouteTabsContent.svelte';
	import RouteTabsTrigger from '$lib/components/tabs/RouteTabsTrigger.svelte';
	import OverviewTab from './helpers/OverviewTab.svelte';
	import IdentitiesTable from './helpers/IdentitiesTable.svelte';
	import GroupsTable from './helpers/GroupsTable.svelte';
	import RolesTable from './helpers/RolesTable.svelte';
	import PoliciesTable from './helpers/PoliciesTable.svelte';
	import LicensesTable from './helpers/LicensesTable.svelte';
	import type { PageData } from './$types.js';

	let { data }: { data: PageData } = $props();
	const dataSourceId = data.dataSourceId;
</script>

<div class="flex size-full flex-col gap-4">
	<h1 class="text-2xl">Microsoft 365</h1>

	<RouteTabs defaultTab="overview" class="flex size-full flex-col gap-4 overflow-hidden">
		<TabsList>
			<RouteTabsTrigger value="overview">Overview</RouteTabsTrigger>
			<RouteTabsTrigger value="identities">Identities</RouteTabsTrigger>
			<RouteTabsTrigger value="groups">Groups</RouteTabsTrigger>
			<RouteTabsTrigger value="roles">Roles</RouteTabsTrigger>
			<RouteTabsTrigger value="policies">Policies</RouteTabsTrigger>
			<RouteTabsTrigger value="licenses">Licenses</RouteTabsTrigger>
		</TabsList>

		<RouteTabsContent value="overview" class="flex flex-1 flex-col overflow-hidden">
			<OverviewTab {dataSourceId} />
		</RouteTabsContent>

		<RouteTabsContent value="identities" class="flex flex-1 flex-col overflow-hidden">
			<IdentitiesTable {dataSourceId} />
		</RouteTabsContent>

		<RouteTabsContent value="groups" class="flex flex-1 flex-col overflow-hidden">
			<GroupsTable {dataSourceId} />
		</RouteTabsContent>

		<RouteTabsContent value="roles" class="flex flex-1 flex-col overflow-hidden">
			<RolesTable {dataSourceId} />
		</RouteTabsContent>

		<RouteTabsContent value="policies" class="flex flex-1 flex-col overflow-hidden">
			<PoliciesTable {dataSourceId} />
		</RouteTabsContent>

		<RouteTabsContent value="licenses" class="flex flex-1 flex-col overflow-hidden">
			<LicensesTable {dataSourceId} />
		</RouteTabsContent>
	</RouteTabs>
</div>
