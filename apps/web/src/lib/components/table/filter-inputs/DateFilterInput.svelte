<script lang="ts">
	import DatePicker from '$lib/components/DatePicker.svelte';

	type Props = {
		value: number | undefined;
	};

	let { value = $bindable() }: Props = $props();
</script>

<DatePicker bind:value />
