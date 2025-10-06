import type { DataTableColumn } from '$lib/components/table/types.js';
import type { PaginationOptions } from '@workspace/shared/types/database/index.js';
import { getContext, setContext } from 'svelte';

export type TablePageState = {
	size: number;
	total: number;
	current: number;

	nextPage: () => number;
	previousPage: () => number;
	firstPage: () => number;
	lastPage: () => number;
	visiblePages: () => number[];
};

export type TableColumnState = {
	configs: DataTableColumn[];
	hiddenColumns: Record<string, boolean>;
	sortedColumn?: [string, 'asc' | 'desc'];

	visibleColumns: () => DataTableColumn[];
	hideableColumns: () => DataTableColumn[];

	toggleColumn: (key: string, value?: boolean) => void;
	sortColumn: (key: string) => void;
};

export type TableURLState = PaginationOptions;

interface TableState {
	page: TablePageState;
	columns: TableColumnState;

	globalSearch: string;
	getGlobalSearchFields: () => string[];

	getURLState: () => TableURLState;
}

class TableStateClass implements TableState {
	page: TablePageState = $state({
		size: 50,
		total: 1,
		current: 1,

		previousPage: () => {
			this.page.current = Math.max(this.page.current - 1, 1);
			return this.page.current;
		},
		nextPage: () => {
			this.page.current = Math.min(this.page.current + 1, this.page.total);
			return this.page.current;
		},
		firstPage: () => {
			this.page.current = 1;
			return this.page.current;
		},
		lastPage: () => {
			this.page.current = this.page.total;
			return this.page.current;
		},
		visiblePages: () => {
			const current = this.page.current;
			const lower = Math.max(current === this.page.total ? current - 2 : current - 1, 1);
			const upper = Math.min(current === 1 ? 3 : current + 1, this.page.total);
			return Array.from({ length: upper - lower + 1 }, (_, i) => lower + i);
		}
	});

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
	getGlobalSearchFields() {
		return this.columns.configs.filter((col) => col.searchable).map((col) => col.title);
	}

	getURLState(): TableURLState {
		const sorting = () => {
			if (!this.columns.sortedColumn) return undefined;

			const [col, val] = this.columns.sortedColumn;
			return { [col]: val };
		};

		return {
			page: this.page.current,
			size: this.page.size,

			filters: undefined,
			sorting: sorting(),

			globalSearch: this.globalSearch,
			globalFields: this.columns.configs.filter((col) => col.searchable).map((col) => col.key)
		};
	}
}

const DEFAULT_KEY = Symbol('$table_state');

export const getTableState = (): TableState => {
	return getContext<TableState>(DEFAULT_KEY);
};

export const setTableState = (): TableState => {
	const state = new TableStateClass();
	setContext<TableState>(DEFAULT_KEY, state);
	return state;
};
