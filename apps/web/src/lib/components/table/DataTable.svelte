<script lang="ts">
	import { setTableState } from '$lib/state/DataTable.svelte.js';
	import type { DataTableColumn, TableView } from '$lib/components/table/types.js';
	import TableToolbar from './TableToolbar.svelte';
	import Button from '$lib/components/ui/button/button.svelte';
	import * as Table from '$lib/components/ui/table/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import { ChevronLeft, ChevronsLeft, ChevronsRight, ChevronsUpDown } from 'lucide-svelte';
	import { cn } from '$lib/utils.js';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import ChevronUp from '@lucide/svelte/icons/chevron-up';
	import Loader from '$lib/components/Loader.svelte';

	type Props = {
		rows: any[];
		isLoading: boolean;
		columns: DataTableColumn<any>[];
		views?: TableView[];
		filters?: any;
	};

	let { rows, columns, views = [], filters = $bindable(), isLoading }: Props = $props();
	const tableState = setTableState();
	tableState.columns.configs = columns;
	tableState.views = views;

	$effect(() => {
		tableState.data = rows;
	});

	// Two-way binding: sync filters with parent
	$effect(() => {
		filters = tableState.getDynamicCrudFilters();
	});
</script>

<div class="flex size-full flex-col gap-2 overflow-hidden">
	<!--Toolbar-->
	<TableToolbar />

	<!--Table-->
	<Table.Root>
		<Table.Header>
			<Table.Row class="sticky top-0 z-50 bg-input">
				{#each tableState.columns.visibleColumns() as col}
					<Table.Head
						onclick={() => {
							if (col.sortable) {
								tableState.columns.sortColumn(col.key);
							}
						}}
						class={cn(
							col.sortable &&
								'items-center hover:cursor-pointer [&>*]:inline-block [&>*]:align-middle'
						)}
						style={`width: ${col.width || ''}`}
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
					</Table.Head>
				{/each}
			</Table.Row>
		</Table.Header>
		<Table.Body>
			{#if isLoading && !tableState.getRows().length}
				<Table.Row>
					<Table.Cell colspan={tableState.columns.visibleColumns().length}>
						<Loader />
					</Table.Cell>
				</Table.Row>
			{/if}
			{#each tableState.getRows() as row}
				<Table.Row>
					{#each tableState.columns.visibleColumns() as col}
						{#if col.cell}
							<Table.Cell style={`width: ${col.width || ''}`}>
								{@render col.cell({ row, column: col })}
							</Table.Cell>
						{:else if col.render}
							<Table.Cell style={`width: ${col.width || ''}`}>
								{col.render({ row, column: col })}
							</Table.Cell>
						{:else}
							<Table.Cell style={`width: ${col.width || ''}`}>
								{row[col.key]}
							</Table.Cell>
						{/if}
					{/each}
				</Table.Row>
			{/each}
		</Table.Body>
	</Table.Root>

	<!--TableFooter-->
	<div class="mt-auto grid w-full grid-cols-3 rounded bg-input p-2 text-sm shadow">
		<div class="flex items-center justify-start">
			Page {tableState.page.current} of {tableState.page.total}
		</div>
		<div class="flex items-center justify-center gap-1">
			<Button class="h-8 w-8" variant="secondary" onclick={tableState.page.firstPage}>
				<ChevronsLeft />
			</Button>
			<Button class="h-8 w-8" variant="secondary" onclick={tableState.page.previousPage}>
				<ChevronLeft />
			</Button>

			{#each tableState.page.visiblePages() as page}
				<Button
					class="h-8 w-8 "
					variant={tableState.page.current === page ? 'default' : 'ghost'}
					onclick={() => (tableState.page.current = page)}>{page}</Button
				>
			{/each}

			<Button class="h-8 w-8" variant="secondary" onclick={tableState.page.nextPage}>
				<ChevronRight />
			</Button>
			<Button class="h-8 w-8" variant="secondary" onclick={tableState.page.lastPage}>
				<ChevronsRight />
			</Button>
		</div>
		<div class="flex items-center justify-end">
			<Select.Root
				type="single"
				value={String(tableState.page.size)}
				onValueChange={(val) => tableState.page.setSize(parseInt(val))}
			>
				<Select.Trigger>{tableState.page.size}</Select.Trigger>
				<Select.Content>
					<Select.Item value="25">25</Select.Item>
					<Select.Item value="50">50</Select.Item>
					<Select.Item value="100">100</Select.Item>
				</Select.Content>
			</Select.Root>
		</div>
	</div>
</div>
