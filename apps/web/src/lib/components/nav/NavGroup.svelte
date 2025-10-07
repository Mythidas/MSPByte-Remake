<script lang="ts">
	import { setContext } from 'svelte';
	import { ChevronDown, ChevronUp } from 'lucide-svelte';
	import type { ComponentType, Snippet } from 'svelte';
	import { getNavState } from '../../state/Navbar.svelte.js';
	import Button from '$lib/components/ui/button/button.svelte';
	import { cn } from '$lib/utils.js';

	interface Props {
		name: string;
		icon: ComponentType;
		children: Snippet<[]>;
	}

	let { name, icon, children }: Props = $props();

	let open = $state(false);
	let isActive = $state(false);

	const navState = getNavState();
	navState.registerGroup(name);
	setContext('nav-group-name', name);

	$effect(() => {
		if (navState.currentPath) {
			isActive = navState.isGroupActive(name);
		}
	});

	$effect(() => {
		if (isActive) {
			open = true;
		}
	});
</script>

<Button
	variant="ghost"
	class={cn('flex w-full', isActive && 'text-primary hover:text-primary')}
	onclick={() => (open = !open)}
>
	<!-- svelte-ignore svelte_component_deprecated -->
	<svelte:component this={icon} class="w-4" />
	<span class="text-sm">{name}</span>

	{#if open}
		<ChevronUp class="ml-auto w-4" />
	{:else}
		<ChevronDown class="ml-auto w-4" />
	{/if}
</Button>

<div class={`flex w-full flex-col gap-1 ${!open && 'hidden'}`}>
	{@render children?.()}
</div>
