<script lang="ts">
	import { type Snippet, type ComponentProps } from 'svelte';
	import { page } from '$app/state';
	import { Tabs } from '$lib/components/ui/tabs';
	import { setTabState } from '$lib/state/Tabs.svelte';

	type Props = {
		defaultTab: string;
		children: Snippet;
	} & ComponentProps<typeof Tabs>;

	const { defaultTab, children, value, ...props }: Props = $props();
	const tab = page.url.searchParams.get('tab') || defaultTab;

	const tabs = setTabState({ tab });
</script>

<Tabs value={tabs.getTab()} {...props}>
	{@render children()}
</Tabs>
