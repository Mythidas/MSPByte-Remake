<script lang="ts">
	import * as Select from '$lib/components/ui/select/index.js';

	type Props = {
		value: any;
		options: { label: string; value: any }[];
		placeholder?: string;
	};

	let { value = $bindable(), options, placeholder = 'Select option' }: Props = $props();

	// Convert value to string for Select component
	let stringValue = $state(value !== undefined ? String(value) : undefined);

	$effect(() => {
		if (stringValue !== undefined) {
			// Try to find original value type from options
			const option = options.find((opt) => String(opt.value) === stringValue);
			value = option ? option.value : stringValue;
		} else {
			value = undefined;
		}
	});
</script>

<Select.Root
	type="single"
	value={stringValue}
	onValueChange={(val) => (stringValue = val || undefined)}
>
	<Select.Trigger class="w-full">
		{#if stringValue !== undefined}
			{options.find((opt) => String(opt.value) === stringValue)?.label || placeholder}
		{:else}
			{placeholder}
		{/if}
	</Select.Trigger>
	<Select.Content>
		{#each options as option}
			<Select.Item value={String(option.value)}>{option.label}</Select.Item>
		{/each}
	</Select.Content>
</Select.Root>
