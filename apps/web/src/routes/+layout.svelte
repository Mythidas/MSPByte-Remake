<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import { ModeWatcher } from 'mode-watcher';
	import { Toaster } from '$lib/components/ui/sonner/index.js';
	import { browser } from '$app/environment';
	import { setupConvex, useConvexClient } from 'convex-svelte';
	import { PUBLIC_CONVEX_URL } from '$env/static/public';
	import '../app.css';

	let { data, children } = $props();

	setupConvex(PUBLIC_CONVEX_URL);
	const convexClient = useConvexClient();
	convexClient.setAuth(async () => data.token);
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{#if browser}
	<Toaster />
{/if}

<ModeWatcher />
<div class="flex h-screen w-screen flex-col overflow-hidden">
	{@render children?.()}
</div>
