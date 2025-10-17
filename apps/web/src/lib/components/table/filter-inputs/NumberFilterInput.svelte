<script lang="ts">
	import { Input } from '$lib/components/ui/input/index.js';

	type Props = {
		value: number | undefined;
		placeholder?: string;
	};

	let { value = $bindable(), placeholder = 'Enter number' }: Props = $props();

	// Internal string value for the input
	let stringValue = $state(value !== undefined ? String(value) : '');

	$effect(() => {
		if (stringValue === '') {
			value = undefined;
		} else {
			const num = parseFloat(stringValue);
			value = isNaN(num) ? undefined : num;
		}
	});

	function handleInput(e: Event) {
		const target = e.target as HTMLInputElement;
		stringValue = target.value;
	}
</script>

<Input type="number" value={stringValue} oninput={handleInput} {placeholder} class="w-full" />
