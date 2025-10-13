<script lang="ts">
	import SearchBar from '$lib/components/SearchBar.svelte';
	import { setTableState } from '$lib/state/DataTable.svelte.js';
	import { DataTableURLStateSchema, type DataTableColumn } from '$lib/components/table/types.js';
	import Button from '$lib/components/ui/button/button.svelte';
	import * as Table from '$lib/components/ui/table/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import {
		ChevronLeft,
		ChevronsLeft,
		ChevronsRight,
		ChevronsUpDown,
		Eye,
		Search
	} from 'lucide-svelte';
	import { cn } from '$lib/utils.js';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import ChevronUp from '@lucide/svelte/icons/chevron-up';

	type Props = {
		rows: any[];
		isLoading: boolean;
		columns: DataTableColumn<any>[];
	};

	const { rows, columns }: Props = $props();
	const tableState = setTableState();
	tableState.columns.configs = columns;

	$effect(() => {
		tableState.data = rows;
	});

	// $effect(() => {
	// 	const url = new URL(window.location.href);
	// 	const urlState = tableState.getURLState();

	// 	url.searchParams.set('page', urlState.page.toString());
	// 	url.searchParams.set('size', urlState.size.toString());

	// 	if (urlState.globalSearch) {
	// 		url.searchParams.set('search', urlState.globalSearch);
	// 	} else url.searchParams.delete('search');

	// 	if (url.toString() === window.location.href) return;
	// 	goto(url, { replaceState: true, noScroll: true, keepFocus: true });
	// });
</script>

<div class="flex size-full flex-col gap-2 overflow-hidden">
	<!--Header-->
	<div class="grid grid-cols-2">
		<SearchBar
			icon={Search}
			class="w-1/2"
			onSearch={tableState.setGlobalSearch}
			bind:value={tableState.globalSearch}
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
