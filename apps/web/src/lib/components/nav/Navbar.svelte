<script lang="ts">
	import { page } from '$app/state';
	import { setNavState } from '../../state/Navbar.svelte.js';
	import type { Snippet } from 'svelte';

	interface Props {
		children: Snippet<[]>;
	}
	const { children }: Props = $props();

	const navState = setNavState();

	// Keep current path in sync with page navigation
	$effect(() => {
		navState.currentPath = page.url.pathname;
	});
</script>

<nav class="flex size-full flex-col items-center gap-1">
	{@render children?.()}
</nav>
