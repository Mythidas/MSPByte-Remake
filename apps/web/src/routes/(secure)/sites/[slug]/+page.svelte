<script lang="ts">
	import Loader from '$lib/components/Loader.svelte';
	import { api } from '$lib/convex/index.js';
	import { getAppState } from '$lib/state/Application.svelte.js';
	import { useQuery } from 'convex-svelte';

	const { data } = $props();

	const appState = getAppState();
	const siteQuery = useQuery(api.sites.crud.get, {
		id: appState.getSite()?._id
	});

	const site = $derived(siteQuery.data);
</script>

{#if siteQuery.isLoading}
	<div class="flex size-full items-center justify-center">
		<Loader />
	</div>
{:else}
	<div class="flex size-full flex-col gap-4">
		<h1 class="text-2xl font-bold">{site!.name}</h1>

		Home
	</div>
{/if}
