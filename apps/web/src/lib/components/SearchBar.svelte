<script lang="ts">
	import Input from '$lib/components/ui/input/input.svelte';
	import { cn, type WithElementRef } from '$lib/utils.js';
	import type { ComponentType } from 'svelte';
	import type { HTMLInputTypeAttribute, HTMLInputAttributes } from 'svelte/elements';

	type InputType = Exclude<HTMLInputTypeAttribute, 'file'>;

	type Props = {
		onSearch?: (val: string) => void;
		delay?: number;
		icon?: ComponentType;
		value?: string;
		element?: HTMLDivElement;
	} & WithElementRef<
		Omit<HTMLInputAttributes, 'type'> &
			({ type: 'file'; files?: FileList } | { type?: InputType; files?: undefined })
	>;

	let {
		icon,
		delay = 300,
		onSearch,
		class: classValue,
		value = $bindable(),
		element = $bindable(),
		...rest
	}: Props = $props();

	let timeout: ReturnType<typeof setTimeout> | null = null;

	function handleInput(e: Event) {
		value = (e.target as HTMLInputElement).value;

		if (timeout) clearTimeout(timeout);
		timeout = setTimeout(() => {
			onSearch?.(value);
		}, delay);
	}
</script>

<div class="relative flex w-full items-center" bind:this={element}>
	{#if icon}
		<!-- svelte-ignore svelte_component_deprecated -->
		<svelte:component this={icon} class="absolute left-3 w-4" />
	{/if}
	<Input
		{...rest}
		{value}
		oninput={handleInput}
		class={cn(classValue, '!bg-input', icon && 'pl-10')}
	/>
</div>
