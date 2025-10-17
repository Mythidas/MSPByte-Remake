<script lang="ts">
	import { Input } from '$lib/components/ui/input/index.js';

	type Props = {
		value: string | undefined;
		placeholder?: string;
	};

	let { value = $bindable(), placeholder = 'Enter text' }: Props = $props();
</script>

<Input bind:value {placeholder} class="w-full" />
