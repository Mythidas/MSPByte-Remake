<script lang="ts">
	import SearchBar from '$lib/components/SearchBar.svelte';
	import FilterBuilder from './FilterBuilder.svelte';
	import FilterChip from './FilterChip.svelte';
	import ViewsManager from './ViewsManager.svelte';
	import Button from '$lib/components/ui/button/button.svelte';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import { Search, Eye, X } from 'lucide-svelte';
	import { getTableState } from '$lib/state/DataTable.svelte.js';

	const tableState = getTableState();
	// Check if there are any active filters (view + dynamic)
	const hasActiveFilters = $derived(
		tableState.filters.length > 0 || tableState.activeView !== undefined
	);
</script>

<div class="flex flex-col gap-3">
	<!-- Top Row: Search, Views, Add Filter, Column Visibility -->
	<div class="flex items-center justify-between gap-2">
		<div class="flex flex-1 items-center gap-2">
			<!-- Global Search -->
			<SearchBar
				icon={Search}
				class="w-full max-w-sm"
				onSearch={tableState.setGlobalSearch}
				bind:value={tableState.globalSearch}
				placeholder={`Search ${tableState.getGlobalSearchFields().join(', ')}`}
			/>

			<!-- Views Selector -->
			{#if tableState.views.length > 0}
				<ViewsManager
					views={tableState.views}
					activeView={tableState.activeView}
					onSelectView={tableState.applyView}
					onClearView={tableState.clearView}
				/>
			{/if}
		</div>

		<div class="flex items-center gap-2">
			<!-- Add Filter Button -->
			<FilterBuilder
				columns={tableState.columns.configs}
				filterFields={tableState.filterFields}
				onAdd={tableState.addFilter}
			/>

			<!-- Clear All Filters -->
			{#if hasActiveFilters}
				<Button
					variant="ghost"
					size="sm"
					onclick={() => {
						tableState.clearAll();
					}}
					class="gap-2"
				>
					<X class="h-4 w-4" />
					Clear All
				</Button>
			{/if}

			<!-- Column Visibility -->
			{#if tableState.columns.hideableColumns().length}
				<DropdownMenu.Root>
					<DropdownMenu.Trigger>
						{#snippet child({ props })}
							<Button {...props} variant="outline" size="sm">
								<Eye class="h-4 w-4" />
							</Button>
						{/snippet}
					</DropdownMenu.Trigger>
					<DropdownMenu.Content>
						{#each tableState.columns.hideableColumns() as column}
							<DropdownMenu.CheckboxItem
								checked={!tableState.columns.hiddenColumns[column.key]}
								onCheckedChange={() => {
									tableState.columns.toggleColumn(column.key);
								}}
							>
								{column.title}
							</DropdownMenu.CheckboxItem>
						{/each}
					</DropdownMenu.Content>
				</DropdownMenu.Root>
			{/if}
		</div>
	</div>

	<!-- Bottom Row: Active Filter Chips -->
	{#if hasActiveFilters}
		<div class="flex flex-wrap items-center gap-2">
			<!-- View Filter Chips (from active view) -->
			{#if tableState.activeView}
				{#each tableState.activeView.filters as filter, index}
					<FilterChip
						{filter}
						onRemove={() => {
							// View filters can't be removed individually, must clear entire view
						}}
						class="opacity-75"
					/>
				{/each}
			{/if}

			<!-- Dynamic Filter Chips -->
			{#each tableState.filters as filter, index}
				<FilterChip {filter} onRemove={() => tableState.removeFilter(index)} />
			{/each}
		</div>
	{/if}
</div>
