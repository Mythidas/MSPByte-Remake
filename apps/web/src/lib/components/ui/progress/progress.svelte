<script lang="ts">
	import { Progress as ProgressPrimitive } from 'bits-ui';
	import { cn, type WithoutChildrenOrChild } from '$lib/utils.js';

	let {
		ref = $bindable(null),
		class: className,
		max = 100,
		value,
		bgColor = 'bg-primary',
		...restProps
	}: WithoutChildrenOrChild<ProgressPrimitive.RootProps> & { bgColor?: string } = $props();
</script>

<ProgressPrimitive.Root
	bind:ref
	data-slot="progress"
	class={cn(
		'relative h-2 w-full overflow-hidden rounded-full',
		className,
		bgColor ? `${bgColor}/20` : 'bg-primary/20'
	)}
	{value}
	{max}
	{...restProps}
>
	<div
		data-slot="progress-indicator"
		class={cn('h-full w-full flex-1 transition-all', bgColor ? `${bgColor}` : 'bg-primary')}
		style="transform: translateX(-{100 - (100 * (value ?? 0)) / (max ?? 1)}%)"
	></div>
</ProgressPrimitive.Root>
