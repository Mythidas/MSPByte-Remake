<script lang="ts">
	import { type Snippet, type ComponentProps } from 'svelte';
	import { page } from '$app/state';
	import { TabsTrigger } from '$lib/components/ui/tabs';
	import { goto } from '$app/navigation';
	import { getTabState } from '$lib/state/Tabs.svelte';

	type Props = {
		children: Snippet;
	} & ComponentProps<typeof TabsTrigger>;

	const { children, ...props }: Props = $props();
	const tabState = getTabState();

	const onClick = () => {
		const url = new URL(page.url);
		url.searchParams.set('tab', props.value);

		tabState.setTab(props.value);
		goto(url);
	};
</script>

<TabsTrigger onclick={onClick} {...props}>
	{@render children()}
</TabsTrigger>
