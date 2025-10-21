<script lang="ts">
	import type {
		DataTableColumn,
		TableFilter,
		FilterOperator,
		ColumnFilterConfig,
		FilterField
	} from './types.js';
	import { getOperatorLabel } from './types.js';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import Button from '$lib/components/ui/button/button.svelte';
	import { Plus } from 'lucide-svelte';
	import FilterIcon from 'lucide-svelte/icons/filter';
	import Label from '$lib/components/ui/label/label.svelte';

	// Import filter input components
	import TextFilterInput from './filter-inputs/TextFilterInput.svelte';
	import SearchFilterInput from './filter-inputs/SearchFilterInput.svelte';
	import SelectFilterInput from './filter-inputs/SelectFilterInput.svelte';
	import DateFilterInput from './filter-inputs/DateFilterInput.svelte';
	import NumberFilterInput from './filter-inputs/NumberFilterInput.svelte';
	import BooleanFilterInput from './filter-inputs/BooleanFilterInput.svelte';

	type Props = {
		columns: DataTableColumn<any>[];
		filterFields?: FilterField[]; // Optional standalone filter definitions
		onAdd: (filter: TableFilter) => void;
	};

	let { columns, filterFields, onAdd }: Props = $props();

	// Filter state
	let selectedField = $state<string>('');
	let selectedOperator = $state<FilterOperator>('eq');
	let filterValue = $state<any>(undefined);
	let isOpen = $state(false);

	// Determine filter source: use filterFields if provided, otherwise use columns
	const useFilterFields = $derived(!!filterFields && filterFields.length > 0);

	// Build filterable options from filterFields
	const filterableFields = $derived(
		filterFields?.map((field) => ({
			key: field.key,
			label: field.label,
			config: field.config
		})) || []
	);

	// Build filterable options from columns (legacy)
	const filterableColumns = $derived(
		columns
			.filter((col) => col.filter !== undefined || col.filterable !== false)
			.map((col) => ({
				key: col.key,
				label: col.filter?.label || col.title,
				config: col.filter,
				type: col.type
			}))
	);

	// Get all filterable items (either from filterFields or columns)
	const filterableItems = $derived(useFilterFields ? filterableFields : filterableColumns);

	// Get selected item
	const selectedItem = $derived(filterableItems.find((item) => item.key === selectedField));

	// Get filter config (either explicit or derived from type)
	const filterConfig = $derived.by<ColumnFilterConfig | undefined>(() => {
		if (!selectedItem) return undefined;

		// If explicit filter config exists, use it
		if (selectedItem.config) return selectedItem.config;

		// Otherwise, create a default config based on type (legacy support for columns)
		const type = (selectedItem as any).type || 'string';
		switch (type) {
			case 'number':
				return {
					component: 'number',
					operators: ['eq', 'ne', 'gt', 'gte', 'lt', 'lte']
				} as ColumnFilterConfig;
			case 'boolean':
				return { component: 'boolean', operators: ['eq', 'ne'] } as ColumnFilterConfig;
			case 'date':
				return { component: 'date', operators: ['eq', 'gte', 'lte'] } as ColumnFilterConfig;
			default:
				return {
					component: 'text',
					operators: ['eq', 'ne', 'contains', 'startsWith', 'endsWith']
				} as ColumnFilterConfig;
		}
	});

	// Get available operators
	const availableOperators = $derived(filterConfig?.operators || ['eq', 'ne']);

	// Reset form
	function resetForm() {
		selectedField = '';
		selectedOperator = 'eq';
		filterValue = undefined;
	}

	// Handle add filter
	function handleAddFilter() {
		if (!selectedField || filterValue === undefined || filterValue === '') return;

		onAdd({
			field: selectedField,
			operator: selectedOperator,
			value: filterValue
		});

		resetForm();
		isOpen = false;
	}

	// Update operator when field changes
	$effect(() => {
		if (selectedField && filterConfig) {
			// Set to default operator or first available
			const defaultOp = filterConfig.defaultOperator || filterConfig.operators[0];
			selectedOperator = defaultOp;
		}
	});

	// Reset value when field changes
	$effect(() => {
		if (selectedField) {
			filterValue = undefined;
		}
	});
</script>

<Popover.Root bind:open={isOpen}>
	<Popover.Trigger>
		{#snippet child({ props })}
			<Button {...props} variant="outline" size="sm" class="gap-2">
				<FilterIcon class="h-4 w-4" />
				Add Filter
			</Button>
		{/snippet}
	</Popover.Trigger>
	<Popover.Content class="w-80">
		<div class="space-y-4">
			<div class="space-y-2">
				<h4 class="leading-none font-medium">Add Filter</h4>
				<p class="text-sm text-muted-foreground">Create a filter condition for your data</p>
			</div>

			<!-- Field Select -->
			<div class="space-y-2">
				<Label class="text-sm font-medium">Field</Label>
				<Select.Root
					type="single"
					value={selectedField}
					onValueChange={(val) => (selectedField = val || '')}
				>
					<Select.Trigger>
						{selectedItem?.label || 'Select field'}
					</Select.Trigger>
					<Select.Content>
						{#each filterableItems as item}
							<Select.Item value={item.key}>{item.label}</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>
			</div>

			{#if selectedField && filterConfig}
				<!-- Operator Select -->
				<div class="space-y-2">
					<Label class="text-sm font-medium">Operator</Label>
					<Select.Root
						type="single"
						value={selectedOperator}
						onValueChange={(val) => (selectedOperator = val as FilterOperator)}
					>
						<Select.Trigger>
							{getOperatorLabel(selectedOperator)}
						</Select.Trigger>
						<Select.Content>
							{#each availableOperators as operator}
								<Select.Item value={operator}>{getOperatorLabel(operator as any)}</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
				</div>

				<!-- Value Input - render appropriate component -->
				<div class="space-y-2">
					<Label class="text-sm font-medium">Value</Label>

					{#if filterConfig.component === 'text'}
						<TextFilterInput
							bind:value={filterValue}
							placeholder={filterConfig.placeholder || `Enter ${selectedItem?.label.toLowerCase()}`}
						/>
					{:else if filterConfig.component === 'search'}
						<SearchFilterInput
							bind:value={filterValue}
							options={filterConfig.options || []}
							placeholder={filterConfig.placeholder || 'Search...'}
						/>
					{:else if filterConfig.component === 'select'}
						<SelectFilterInput
							bind:value={filterValue}
							options={filterConfig.options || []}
							placeholder={filterConfig.placeholder || 'Select option'}
						/>
					{:else if filterConfig.component === 'date'}
						<DateFilterInput bind:value={filterValue} />
					{:else if filterConfig.component === 'number'}
						<NumberFilterInput
							bind:value={filterValue}
							placeholder={filterConfig.placeholder || 'Enter number'}
						/>
					{:else if filterConfig.component === 'boolean'}
						<BooleanFilterInput
							bind:value={filterValue}
							placeholder={filterConfig.placeholder || 'Select value'}
						/>
					{/if}
				</div>

				<!-- Actions -->
				<div class="flex justify-end gap-2">
					<Button
						variant="outline"
						size="sm"
						onclick={() => {
							resetForm();
							isOpen = false;
						}}
					>
						Cancel
					</Button>
					<Button
						size="sm"
						onclick={handleAddFilter}
						disabled={filterValue === undefined || filterValue === ''}
					>
						<Plus class="mr-2 h-4 w-4" />
						Add
					</Button>
				</div>
			{/if}
		</div>
	</Popover.Content>
</Popover.Root>
