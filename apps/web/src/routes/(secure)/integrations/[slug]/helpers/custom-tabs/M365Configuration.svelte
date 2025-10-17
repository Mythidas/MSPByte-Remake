<script lang="ts">
	import SearchBar from '$lib/components/SearchBar.svelte';
	import Button from '$lib/components/ui/button/button.svelte';
	import { Tabs, TabsList, TabsContent, TabsTrigger } from '$lib/components/ui/tabs';
	import { Plus, Search } from 'lucide-svelte';
	import M365ConnectDialog from '../components/M365ConnectDialog.svelte';

	let isConnectOpen = $state(false);
</script>

<Tabs value="connections" class="size-full overflow-hidden">
	<TabsList>
		<TabsTrigger value="connections">Connections</TabsTrigger>
		<TabsTrigger value="sites">Site Mappings</TabsTrigger>
	</TabsList>

	<TabsContent value="connections">
		<div class="flex w-full justify-between">
			<SearchBar class="w-1/3" placeholder="Search connections" icon={Search} />
			<M365ConnectDialog />
		</div>
		<div class="flex size-full flex-col"></div>
	</TabsContent>
</Tabs>
