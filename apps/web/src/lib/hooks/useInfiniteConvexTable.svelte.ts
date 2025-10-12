import { useQuery } from 'convex-svelte';
import type { FunctionReference, FunctionArgs, FunctionReturnType } from 'convex/server';
import type { DataTableFilter, SortDirection } from '$lib/components/table/types.js';

type PaginatedResult<T> = {
	page: T[];
	continueCursor: string | null;
	isDone: boolean;
};

type UseInfiniteConvexTableOptions<Query extends FunctionReference<'query'>> = {
	query: Query;
	baseArgs?: Omit<FunctionArgs<Query>, 'paginationOpts'>;
	numItems?: number;
};

type UseInfiniteConvexTableReturn<T> = {
	rows: T[];
	isLoading: boolean;
	isDone: boolean;
	loadMore: () => void;
	search: string;
	setSearch: (query: string) => void;
	filters: DataTableFilter;
	setFilters: (filters: DataTableFilter) => void;
	sortColumn: string | undefined;
	sortDirection: SortDirection | undefined;
	setSort: (column: string | undefined, direction: SortDirection | undefined) => void;
	reset: () => void;
};

/**
 * Hook for using Convex paginated queries with infinite scrolling.
 * Automatically accumulates rows and manages cursor state.
 * Resets when search, filters, or sort changes.
 *
 * @example
 * const table = useInfiniteConvexTable({
 *   query: api.sites.crud.paginate,
 *   baseArgs: { status: 'active' },
 *   numItems: 50
 * });
 *
 * // Use with DataTable
 * <DataTable
 *   rows={table.rows}
 *   isLoading={table.isLoading}
 *   isDone={table.isDone}
 *   onLoadMore={table.loadMore}
 *   onSearch={table.setSearch}
 *   onSort={table.setSort}
 * />
 */
export function useInfiniteConvexTable<
	Query extends FunctionReference<'query'>,
	T = FunctionReturnType<Query> extends PaginatedResult<infer U> ? U : never
>(options: UseInfiniteConvexTableOptions<Query>): UseInfiniteConvexTableReturn<T> {
	const { query, baseArgs = {} as any, numItems = 50 } = options;

	// State for infinite scrolling
	let cursor = $state<string | null>(null);
	let accumulatedRows = $state<T[]>([]);
	let previousCursor = $state<string | null | undefined>(undefined);

	// State for filters, search, and sort
	let search = $state('');
	let filters = $state<DataTableFilter>({});
	let sortColumn = $state<string | undefined>(undefined);
	let sortDirection = $state<SortDirection | undefined>(undefined);

	// Track previous values to detect changes
	let prevSearch = $state('');
	let prevFilters = $state<DataTableFilter>({});
	let prevSortColumn = $state<string | undefined>(undefined);
	let prevSortDirection = $state<SortDirection | undefined>(undefined);

	// Execute the query with reactive args
	const result = useQuery(query, () => {
		const args: any = {
			...baseArgs,
			paginationOpts: {
				numItems,
				cursor
			}
		};

		// Add search if provided
		if (search) {
			args.globalSearch = search;
		}

		// Add filters if provided
		if (Object.keys(filters).length > 0) {
			args.filters = filters;
		}

		// Add sorting if provided
		if (sortColumn && sortDirection) {
			args.sortColumn = sortColumn;
			args.sortDirection = sortDirection;
		}

		return args;
	});

	// Track loaded pages by cursor to enable reactive updates
	let loadedPages = $state<Map<string | null, T[]>>(new Map());
	let cursorOrder = $state<(string | null)[]>([]);

	// Effect to accumulate rows and detect resets
	$effect(() => {
		const data = result.data as PaginatedResult<T> | undefined;

		// Check if search, filters, or sort changed - if so, reset
		if (
			search !== prevSearch ||
			filters !== prevFilters ||
			sortColumn !== prevSortColumn ||
			sortDirection !== prevSortDirection
		) {
			// Reset accumulated rows and cursor
			cursor = null;
			accumulatedRows = [];
			loadedPages = new Map();
			cursorOrder = [];
			previousCursor = undefined;

			prevSearch = search;
			prevFilters = filters;
			prevSortColumn = sortColumn;
			prevSortDirection = sortDirection;
		}

		// Update or accumulate rows when data arrives
		if (data && data.page.length > 0) {
			// Track if this is a new page
			const isNewPage = !loadedPages.has(cursor);

			// Store/update the current page data indexed by cursor
			loadedPages.set(cursor, data.page);

			// Add to cursor order if this is a new page
			if (isNewPage) {
				cursorOrder = [...cursorOrder, cursor];
			}

			// Rebuild accumulated rows from all loaded pages in order
			accumulatedRows = cursorOrder.flatMap(c => loadedPages.get(c) ?? []);

			previousCursor = cursor;
		}
	});

	const loadMore = () => {
		const data = result.data as PaginatedResult<T> | undefined;
		if (data && data.continueCursor && !result.isLoading) {
			cursor = data.continueCursor;
		}
	};

	const setSearch = (query: string) => {
		search = query;
	};

	const setFilters = (newFilters: DataTableFilter) => {
		filters = newFilters;
	};

	const setSort = (column: string | undefined, direction: SortDirection | undefined) => {
		sortColumn = column;
		sortDirection = direction;
	};

	const reset = () => {
		cursor = null;
		accumulatedRows = [];
		previousCursor = undefined;
		search = '';
		filters = {};
		sortColumn = undefined;
		sortDirection = undefined;
	};

	const data = $derived(result.data as PaginatedResult<T> | undefined);

	return {
		get rows() {
			return accumulatedRows;
		},
		get isLoading() {
			return result.isLoading;
		},
		get isDone() {
			return data?.isDone ?? false;
		},
		loadMore,
		get search() {
			return search;
		},
		setSearch,
		get filters() {
			return filters;
		},
		setFilters,
		get sortColumn() {
			return sortColumn;
		},
		get sortDirection() {
			return sortDirection;
		},
		setSort,
		reset
	};
}
