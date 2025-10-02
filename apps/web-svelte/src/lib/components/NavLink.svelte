<script lang="ts">
	import { page } from '$app/state';
	import { getContext, hasContext } from 'svelte';
	import type { ComponentType } from 'svelte';

	interface Props {
		href: string;
		label: string;
		icon: ComponentType;
	}

	let { href, label, icon }: Props = $props();

	const isActive = $derived(
		href === '/' ? page.url.pathname === '/' : page.url.pathname.startsWith(href)
	);

	$effect(() => {
		if (hasContext('navGroup')) {
			const navGroup = getContext<{ registerRoute: (route: string) => void }>('navGroup');
			navGroup.registerRoute(href);
		}
	});
</script>

<a
	{href}
	class={`btn flex w-full items-center justify-start gap-2 py-2 shadow-xl ${isActive ? 'preset-filled-surface-100-900' : 'hover:preset-filled-surface-100-900'}`}
>
	<!-- svelte-ignore svelte_component_deprecated -->
	<svelte:component this={icon} class="w-4" />
	<span class="pt-1 text-sm">{label}</span>
</a>
