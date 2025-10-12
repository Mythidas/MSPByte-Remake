import type { DataTableColumn, DataTableFilter, SortDirection } from '$lib/components/table/types.js';
import { getContext, setContext } from 'svelte';

export type TableColumnState = {
	configs: DataTableColumn[];
	hiddenColumns: Record<string, boolean>;
	sortedColumn?: [string, SortDirection];

	visibleColumns: () => DataTableColumn[];
	hideableColumns: () => DataTableColumn[];

	toggleColumn: (key: string, value?: boolean) => void;
	sortColumn: (key: string) => void;
};

interface InfiniteTableState {
	columns: TableColumnState;
	globalSearch: string;
	filters: DataTableFilter;

	getGlobalSearchFields: () => string[];
}

class InfiniteTableStateClass implements InfiniteTableState {
	columns: TableColumnState = $state({
		configs: [],
		hiddenColumns: {},
		sortedColumn: undefined,

		visibleColumns: () => {
			return this.columns.configs.filter((col) => !this.columns.hiddenColumns[col.key]);
		},

		hideableColumns: () => {
			return this.columns.configs.filter((col) => col.hideable);
		},

		toggleColumn: (key, value) => {
			if (value !== undefined) {
				this.columns.hiddenColumns[key] = value;
				return;
			}

			if (this.columns.hiddenColumns[key]) {
				this.columns.hiddenColumns[key] = false;
			} else {
				this.columns.hiddenColumns[key] = true;
			}
		},

		sortColumn: (key) => {
			if (this.columns.sortedColumn) {
				const [col, val] = this.columns.sortedColumn;
				if (col === key) {
					if (val === 'asc') this.columns.sortedColumn = [key, 'desc'];
					else this.columns.sortedColumn = undefined;
				} else this.columns.sortedColumn = [key, 'asc'];
			} else this.columns.sortedColumn = [key, 'asc'];
		}
	});

	globalSearch: string = $state('');
	filters: DataTableFilter = $state({});

	getGlobalSearchFields() {
		return this.columns.configs.filter((col) => col.searchable).map((col) => col.title);
	}
}

const DEFAULT_KEY = Symbol('$infinite_table_state');

export const getInfiniteTableState = (): InfiniteTableState => {
	return getContext<InfiniteTableState>(DEFAULT_KEY);
};

export const setInfiniteTableState = (): InfiniteTableState => {
	const state = new InfiniteTableStateClass();
	setContext<InfiniteTableState>(DEFAULT_KEY, state);
	return state;
};
