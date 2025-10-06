<script lang="ts">
	import { getContext, hasContext } from 'svelte';
	import type { ComponentType } from 'svelte';
	import { getNavState } from './NavState.svelte.js';
	import Button from '$lib/components/ui/button/button.svelte';
	import { cn } from '$lib/utils.js';

	interface Props {
		href: string;
		label: string;
		icon: ComponentType;
	}

	let { href, label, icon }: Props = $props();

	const navState = getNavState();
	const groupName = hasContext('nav-group-name') ? getContext<string>('nav-group-name') : undefined;
	navState.registerRoute(href, groupName);

	const isActive = $derived(navState.isRouteActive(href));
</script>

<Button variant="ghost" class={cn('flex w-full px-0 !py-0', isActive && 'bg-secondary')}>
	<a {href} class={cn('flex size-full items-center justify-start gap-2 px-3', groupName && 'pl-6')}>
		<!-- svelte-ignore svelte_component_deprecated -->
		<svelte:component this={icon} class="w-4" />
		<span class="text-sm">{label}</span>
	</a>
</Button>
