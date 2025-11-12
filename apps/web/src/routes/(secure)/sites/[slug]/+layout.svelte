<script lang="ts">
	import { getAppState } from '$lib/state/Application.svelte.js';

	const { data, children } = $props();
	const appState = getAppState();

	$effect(() => {
		if (data.site) {
			appState.setSite(data.site);
			// Update linkedIntegrations to reflect the current site's integrations
			appState.siteLinkedIntegrations = data.site.linkedIntegrations || [];
		}
	});
</script>

{@render children()}
