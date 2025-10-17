<script lang="ts">
	import * as Select from '$lib/components/ui/select/index.js';

	type Props = {
		value: boolean | undefined;
		placeholder?: string;
	};

	let { value = $bindable(), placeholder = 'Select value' }: Props = $props();

	let stringValue = $state(value !== undefined ? String(value) : undefined);

	$effect(() => {
		if (stringValue === 'true') {
			value = true;
		} else if (stringValue === 'false') {
			value = false;
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
		{#if value === true}
			True
		{:else if value === false}
			False
		{:else}
			{placeholder}
		{/if}
	</Select.Trigger>
	<Select.Content>
		<Select.Item value="true">True</Select.Item>
		<Select.Item value="false">False</Select.Item>
	</Select.Content>
</Select.Root>
