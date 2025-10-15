<script lang="ts">
	import Loader from '$lib/components/Loader.svelte';
	import Button from '$lib/components/ui/button/button.svelte';
	import type { ComponentProps } from 'svelte';

	type Props = {
		isLoading?: boolean;
	} & ComponentProps<typeof Button>;

	const { isLoading, type = 'submit', children, disabled, ...rest }: Props = $props();
</script>

<Button {type} {...rest} disabled={isLoading || disabled}>
	{#if isLoading}
		<Loader size="sm" />
	{/if}
	{#if children}
		{@render children()}
	{/if}
</Button>
