<script lang="ts">
	import { setContext, getContext, hasContext } from 'svelte';
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
	const parentGroupName = hasContext('nav-group-name') ? getContext<string>('nav-group-name') : undefined;
	const nestingLevel = hasContext('nav-nesting-level') ? getContext<number>('nav-nesting-level') : 0;

	navState.registerGroup(name, parentGroupName);
	setContext('nav-group-name', name);
	setContext('nav-nesting-level', nestingLevel + 1);

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

	// Calculate padding based on nesting level (each level adds 1.5rem)
	const paddingLeft = nestingLevel > 0 ? `${nestingLevel * 1.5}rem` : undefined;
</script>

<Button
	variant="ghost"
	class={cn(
		'flex w-full',
		isActive && 'text-primary hover:text-primary'
	)}
	style={paddingLeft ? `padding-left: ${paddingLeft}` : undefined}
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

<div class={cn('flex w-full flex-col gap-1', !open && 'hidden')}>
	{@render children?.()}
</div>
