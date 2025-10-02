<script lang="ts">
	import { page } from '$app/state';
	import { setContext } from 'svelte';
	import { ChevronDown, ChevronUp } from 'lucide-svelte';
	import type { ComponentType, Snippet } from 'svelte';

	interface Props {
		name: string;
		icon: ComponentType;
		children: Snippet<[]>;
	}

	let { name, icon, children }: Props = $props();

	let open = $state(false);
	let childRoutes = $state<string[]>([]);

	// Provide a way for children to register their routes
	setContext('navGroup', {
		registerRoute: (route: string) => {
			if (!childRoutes.includes(route)) {
				childRoutes = [...childRoutes, route];
			}
		}
	});

	// Check if any child route is active
	const isActive = $derived(
		childRoutes.some((route) => {
			if (typeof window !== 'undefined') {
				const currentPath = page.url.pathname;
				return currentPath.startsWith(route);
			}
			return false;
		})
	);
</script>

<button
	class={`btn flex w-full items-center justify-start gap-2 py-2 shadow-xl ${isActive ? 'preset-filled-surface-100-900' : 'hover:preset-filled-surface-100-900'}`}
	onclick={() => (open = !open)}
>
	<!-- svelte-ignore svelte_component_deprecated -->
	<svelte:component this={icon} class="w-4" />
	<span class="pt-1 text-sm">{name}</span>

	{#if open}
		<ChevronUp class="ml-auto w-4" />
	{:else}
		<ChevronDown class="ml-auto w-4" />
	{/if}
</button>

{#if open}
	<div class="flex w-full flex-col gap-1">
		{@render children?.()}
	</div>
{/if}
