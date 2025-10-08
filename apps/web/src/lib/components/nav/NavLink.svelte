<script lang="ts">
	import { getContext, hasContext } from 'svelte';
	import type { ComponentType } from 'svelte';
	import { getNavState } from '../../state/Navbar.svelte.js';
	import Button from '$lib/components/ui/button/button.svelte';
	import { cn } from '$lib/utils.js';

	interface Props {
		href: string;
		label: string;
		exact?: boolean;
		icon?: ComponentType;
	}

	let { href, label, exact, icon }: Props = $props();

	const navState = getNavState();
	const groupName = hasContext('nav-group-name') ? getContext<string>('nav-group-name') : undefined;
	const nestingLevel = hasContext('nav-nesting-level') ? getContext<number>('nav-nesting-level') : 0;
	navState.registerRoute(href, groupName);

	const isActive = $derived(navState.isRouteActive(href, exact));

	// Calculate padding based on nesting level (each level adds 1.5rem)
	const paddingLeft = nestingLevel > 0 ? `${nestingLevel * 1.5}rem` : undefined;
</script>

<Button variant="ghost" class={cn('flex w-full px-0 !py-0', isActive && 'bg-secondary')}>
	<a
		{href}
		class="flex size-full items-center justify-start gap-2 px-3"
		style={paddingLeft ? `padding-left: ${paddingLeft}` : undefined}
	>
		{#if icon}
			<!-- svelte-ignore svelte_component_deprecated -->
			<svelte:component this={icon} class="w-4" />
		{/if}
		<span class="text-sm">{label}</span>
	</a>
</Button>
