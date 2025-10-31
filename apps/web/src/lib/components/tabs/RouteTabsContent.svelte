<script lang="ts">
	import { type Snippet, type ComponentProps } from 'svelte';
	import { TabsContent } from '$lib/components/ui/tabs';
	import { getTabState } from '$lib/state/Tabs.svelte';

	type Props = {
		children: Snippet;
	} & ComponentProps<typeof TabsContent>;

	const { children, ...props }: Props = $props();
	const tabState = getTabState();
</script>

{#if tabState.getTab() === props.value}
	<TabsContent {...props}>
		{@render children()}
	</TabsContent>
{/if}
