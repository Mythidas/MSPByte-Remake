<script lang="ts">
	import SearchBox from '$lib/components/SearchBox.svelte';
	import { Search } from 'lucide-svelte';

	type Props = {
		value: string | undefined;
		options: { label: string; value: any }[];
		placeholder?: string;
	};

	let { value = $bindable(), options, placeholder = 'Search...' }: Props = $props();
</script>

<SearchBox {options} {placeholder} icon={Search} onSelect={(val) => (value = val)} class="w-full" />
