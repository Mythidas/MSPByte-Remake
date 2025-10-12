<script lang="ts">
	import SearchBar from '$lib/components/SearchBar.svelte';
	import { setInfiniteTableState } from '$lib/state/InfiniteTable.svelte.js';
	import type { DataTableColumn } from '$lib/components/table/types.js';
	import Button from '$lib/components/ui/button/button.svelte';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import { cn } from '$lib/utils.js';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import ChevronUp from '@lucide/svelte/icons/chevron-up';
	import { ChevronsUpDown, Eye, Search, LoaderCircle } from 'lucide-svelte';
	import { onMount } from 'svelte';

	type SortDirection = 'asc' | 'desc';

	type Props = {
		rows: any[];
		columns: DataTableColumn[];
		isLoading: boolean;
		isDone: boolean;
		onLoadMore: () => void;
		onSearch?: (query: string) => void;
		onSort?: (column: string, direction: SortDirection) => void;
		rowHeight?: number;
	};

	const {
		rows,
		columns,
		isLoading,
		isDone,
		onLoadMore,
		onSearch,
		onSort,
		rowHeight = 57
	}: Props = $props();

	const tableState = setInfiniteTableState();
	tableState.columns.configs = columns;

	// Virtual scrolling state
	let scrollContainer: HTMLDivElement;
	let scrollTop = $state(0);
	let containerHeight = $state(0);

	// Calculate visible rows for virtual scrolling
	const visibleStartIndex = $derived(Math.floor(scrollTop / rowHeight));
	const visibleEndIndex = $derived(
		Math.min(visibleStartIndex + Math.ceil(containerHeight / rowHeight) + 1, rows.length)
	);
	const visibleRows = $derived(rows.slice(visibleStartIndex, visibleEndIndex));
	const totalHeight = $derived(rows.length * rowHeight);

	// Intersection observer for loading more
	let sentinelElement: HTMLDivElement;

	onMount(() => {
		// Set up scroll listener
		const handleScroll = () => {
			if (scrollContainer) {
				scrollTop = scrollContainer.scrollTop;
			}
		};

		if (scrollContainer) {
			scrollContainer.addEventListener('scroll', handleScroll);
			containerHeight = scrollContainer.clientHeight;
		}

		// Set up intersection observer for load more
		const observer = new IntersectionObserver(
			(entries) => {
				const entry = entries[0];
				if (entry.isIntersecting && !isLoading && !isDone) {
					onLoadMore();
				}
			},
			{
				root: scrollContainer,
				threshold: 0.1
			}
		);

		if (sentinelElement) {
			observer.observe(sentinelElement);
		}

		// Handle resize
		const resizeObserver = new ResizeObserver(() => {
			if (scrollContainer) {
				containerHeight = scrollContainer.clientHeight;
			}
		});

		if (scrollContainer) {
			resizeObserver.observe(scrollContainer);
		}

		return () => {
			if (scrollContainer) {
				scrollContainer.removeEventListener('scroll', handleScroll);
			}
			observer.disconnect();
			resizeObserver.disconnect();
		};
	});

	// Handle search
	const handleSearch = (query: string) => {
		tableState.globalSearch = query;
		if (onSearch) {
			onSearch(query);
		}
	};

	// Handle sort
	const handleSort = (columnKey: string) => {
		const column = columns.find((col) => col.key === columnKey);
		if (!column?.sortable) return;

		tableState.columns.sortColumn(columnKey);

		if (onSort && tableState.columns.sortedColumn) {
			const [col, direction] = tableState.columns.sortedColumn;
			onSort(col, direction);
		} else if (onSort) {
			onSort(columnKey, 'asc');
		}
	};
</script>

<div class="flex size-full flex-col gap-2 overflow-hidden">
	<!--Header-->
	<div class="grid grid-cols-2">
		<SearchBar
			icon={Search}
			class="w-1/2"
			onSearch={handleSearch}
			placeholder={`Search ${tableState.getGlobalSearchFields().join(', ')}`}
		/>

		<div class="flex justify-end gap-2">
			{#if tableState.columns.hideableColumns().length}
				<DropdownMenu.Root>
					<DropdownMenu.Trigger>
						{#snippet child({ props })}
							<Button {...props} variant="outline">
								<Eye class="w-4" />
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

	<!--Table Container with Virtual Scrolling-->
	<div bind:this={scrollContainer} class="relative flex-1 overflow-auto">
		<table class="w-full caption-bottom text-sm">
			<thead
				class="sticky top-0 z-50 bg-input [&_tr]:border-b"
				style="display: block; width: 100%;"
			>
				<tr
					class="border-b transition-colors data-[state=selected]:bg-muted"
					style="display: flex; width: 100%;"
				>
					{#each tableState.columns.visibleColumns() as col}
						<th
							onclick={() => handleSort(col.key)}
							class={cn(
								'h-12 px-4 text-left align-middle font-medium text-muted-foreground',
								!col.width && 'flex-1',
								col.sortable &&
									'items-center hover:cursor-pointer hover:bg-muted/50 [&>*]:inline-block [&>*]:align-middle'
							)}
							style={`display: flex; align-items: center; ${col.width ? `width: ${col.width}; flex-shrink: 0;` : ''}`}
						>
							<span>{col.title}</span>
							{#if col.sortable}
								{#if tableState.columns.sortedColumn?.[0] === col.key}
									{#if tableState.columns.sortedColumn[1] === 'asc'}
										<ChevronDown class="w-4" />
									{:else}
										<ChevronUp class="w-4" />
									{/if}
								{:else}
									<ChevronsUpDown class="w-4" />
								{/if}
							{/if}
						</th>
					{/each}
				</tr>
			</thead>
			<tbody
				class="[&_tr:last-child]:border-0"
				style="display: block; position: relative; height: {totalHeight}px; width: 100%;"
			>
				{#each visibleRows as row, idx}
					<tr
						class="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted"
						style="position: absolute; top: {(visibleStartIndex + idx) *
							rowHeight}px; height: {rowHeight}px; width: 100%; display: flex;"
					>
						{#each tableState.columns.visibleColumns() as col}
							{#if col.cell}
								<td
									class={cn('p-4 align-middle', !col.width && 'flex-1')}
									style={`display: flex; align-items: center; ${col.width ? `width: ${col.width}; flex-shrink: 0;` : ''}`}
								>
									{@render col.cell({ row, column: col })}
								</td>
							{:else if col.render}
								<td
									class={cn('p-4 align-middle', !col.width && 'flex-1')}
									style={`display: flex; align-items: center; ${col.width ? `width: ${col.width}; flex-shrink: 0;` : ''}`}
								>
									{col.render({ row, column: col })}
								</td>
							{:else}
								<td
									class={cn('p-4 align-middle', !col.width && 'flex-1')}
									style={`display: flex; align-items: center; ${col.width ? `width: ${col.width}; flex-shrink: 0;` : ''}`}
								>
									{row[col.key]}
								</td>
							{/if}
						{/each}
					</tr>
				{/each}
			</tbody>
		</table>

		<!-- Sentinel element for intersection observer -->
		<div bind:this={sentinelElement} class="h-4"></div>

		<!-- Loading indicator -->
		{#if isLoading}
			<div class="flex items-center justify-center gap-2 py-4">
				<LoaderCircle class="h-4 w-4 animate-spin" />
				<span class="text-sm text-muted-foreground">Loading more...</span>
			</div>
		{/if}

		<!-- End of data indicator -->
		{#if isDone && rows.length > 0}
			<div class="flex items-center justify-center py-4">
				<span class="text-sm text-muted-foreground">End of data</span>
			</div>
		{/if}

		<!-- Empty state -->
		{#if rows.length === 0 && !isLoading}
			<div class="flex items-center justify-center py-12">
				<span class="text-sm text-muted-foreground">No data found</span>
			</div>
		{/if}
	</div>
</div>
