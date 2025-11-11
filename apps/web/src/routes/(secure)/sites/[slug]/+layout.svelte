<script lang="ts">
	import { getAppState } from '$lib/state/Application.svelte.js';

	const { data, children } = $props();
	const appState = getAppState();

	$effect(() => {
		if (data.site) {
			appState.setSite(data.site);
		}
	});
</script>

{@render children()}
