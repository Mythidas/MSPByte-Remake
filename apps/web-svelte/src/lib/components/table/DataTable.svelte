<script lang="ts">
	import SearchBar from '$lib/components/SearchBar.svelte';
	import { setTableState, type TableURLState } from '$lib/components/table/state.svelte.js';
	import type { DataTableColumn } from '$lib/components/table/types.js';
	import Button from '$lib/components/ui/button/button.svelte';
	import * as Table from '$lib/components/ui/table/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import { ChevronLeft, ChevronsLeft, ChevronsRight, Eye, Search } from 'lucide-svelte';
	import { goto } from '$app/navigation';
	import type { DataResponse } from '@workspace/shared/types/database/index.js';
	import ScrollArea from '$lib/components/ui/scroll-area/scroll-area.svelte';

	type Props = {
		fetcher: (state: TableURLState) => Promise<DataResponse<any>>;
		columns: DataTableColumn[];
	};

	const { fetcher, columns }: Props = $props();
	const tableState = setTableState();
	let data = $state({ rows: [] as any[], total: 0 });

	tableState.columns.configs = columns;

	async function loadData(state: TableURLState) {
		data = await fetcher(state);
	}

	$effect(() => {
		const urlState = tableState.getURLState();
		loadData(urlState);
	});

	$effect(() => {
		const url = new URL(window.location.href);
		const urlState = tableState.getURLState();

		url.searchParams.set('page', urlState.page.toString());
		url.searchParams.set('size', urlState.size.toString());

		if (urlState.globalSearch) {
			url.searchParams.set('search', urlState.globalSearch);
		} else url.searchParams.delete('search');

		if (url.toString() === window.location.href) return;
		goto(url, { replaceState: true, noScroll: true, keepFocus: true });
	});
</script>

<div class="flex size-full flex-col gap-2 overflow-hidden">
	<!--Header-->
	<div class="grid grid-cols-2">
		<SearchBar
			icon={Search}
			class="w-1/2"
			onSearch={(val) => (tableState.globalSearch = val)}
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
								onCheckedChange={(val) => {
									if (val) tableState.columns.showColumn(column.key);
									else tableState.columns.hideColumn(column.key);
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
					<Table.Head>{col.title}</Table.Head>
				{/each}
			</Table.Row>
		</Table.Header>
		<Table.Body>
			{#each data.rows as row}
				<Table.Row>
					{#each tableState.columns.visibleColumns() as col}
						<Table.Cell>
							{col.render ? col.render({ row }) : row[col.key]}
						</Table.Cell>
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
			<Button class="h-8 w-8" variant="secondary" onclick={() => (tableState.page.current = 1)}>
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
			<Button
				class="h-8 w-8"
				variant="secondary"
				onclick={() => (tableState.page.current = tableState.page.total)}
			>
				<ChevronsRight />
			</Button>
		</div>
		<div class="flex items-center justify-end">
			<Select.Root
				type="single"
				value={String(tableState.page.size)}
				onValueChange={(val) => (tableState.page.size = parseInt(val))}
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
