<script lang="ts">
	import SearchBar from '$lib/components/SearchBar.svelte';
	import Button from '$lib/components/ui/button/button.svelte';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import ScrollArea from '$lib/components/ui/scroll-area/scroll-area.svelte';
	import { cn } from '$lib/utils.js';
	import type { WithElementRef } from 'bits-ui';
	import type { ComponentType } from 'svelte';
	import type { HTMLInputTypeAttribute, HTMLInputAttributes } from 'svelte/elements';

	type InputType = Exclude<HTMLInputTypeAttribute, 'file'>;
	type Option = { label: string; value: string };

	type Props = {
		options: Option[];
		onSelect?: (val: string) => void;
		onSearch?: (val: string) => void;
		delay?: number;
		icon?: ComponentType;
	} & WithElementRef<
		Omit<HTMLInputAttributes, 'type'> &
			({ type: 'file'; files?: FileList } | { type?: InputType; files?: undefined })
	>;

	const {
		options,
		onSelect,
		onSearch,
		placeholder,
		defaultValue,
		class: classValue,
		...rest
	}: Props = $props();

	let selected = $state('');
	let search = $state('');
	let open = $state(false);
	let triggerWidth = $state(0);
	let triggerElement: HTMLDivElement | undefined = $state();

	const handleSearch = (val: string) => {
		onSearch?.(val);
		search = val;
	};

	const handleSelect = (val: string) => {
		onSelect?.(val);
		selected = val;

		open = false;
		search = '';
	};

	const filteredOptions = () => {
		if (!options.length) return [];

		const filtered = options.filter(({ label }) =>
			label.toLowerCase().includes(search.toLowerCase())
		);

		return filtered;
	};

	$effect(() => {
		if (triggerElement && open) {
			triggerWidth = triggerElement.offsetWidth;
		}
	});
</script>

<Popover.Root bind:open>
	<Popover.Trigger>
		<SearchBar
			placeholder={options.find((opt) => opt.value === selected || opt.value === defaultValue)
				?.label || placeholder}
			onSearch={handleSearch}
			class={classValue}
			bind:value={search}
			bind:element={triggerElement}
			{...rest}
		/>
	</Popover.Trigger>
	<Popover.Content
		class={cn('p-1')}
		style={{ width: `!${triggerWidth}px` }}
		onOpenAutoFocus={(e) => e.preventDefault()}
	>
		<ScrollArea class="max-h-96 overflow-auto" style={{ width: `${triggerWidth}px` }} type="always">
			<div>
				{#if !options.length}
					<div>No options available</div>
				{:else if !filteredOptions().length}
					<div>No options found, update search.</div>
				{:else}
					{#each filteredOptions() as option}
						<Button
							variant="ghost"
							class="w-full justify-start"
							onclick={() => handleSelect(option.value)}
						>
							{option.label}
						</Button>
					{/each}
				{/if}
			</div>
		</ScrollArea>
	</Popover.Content>
</Popover.Root>
