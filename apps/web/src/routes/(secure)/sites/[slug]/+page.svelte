<script lang="ts">
	import Loader from '$lib/components/Loader.svelte';
	import { api, type Doc } from '$lib/convex/index.js';
	import { getAppState } from '$lib/state/Application.svelte.js';
	import { useQuery } from 'convex-svelte';
	import { Construction } from 'lucide-svelte';

	const appState = getAppState();
	const siteQuery = useQuery(api.helpers.orm.get, {
		id: appState.getSite()?._id,
		tableName: 'sites'
	});

	const site = $derived(siteQuery.data as Doc<'sites'> | undefined);
</script>

{#if siteQuery.isLoading}
	<div class="flex size-full items-center justify-center">
		<Loader />
	</div>
{:else}
	<div class="flex size-full flex-col gap-4">
		<h1 class="text-2xl font-bold">{site!.name}</h1>
		<div class="flex size-full flex-col items-center justify-center gap-2">
			<Construction class="h-24 w-24" />
			<span class="text-3xl">This page is a WIP</span>
		</div>
	</div>
{/if}
