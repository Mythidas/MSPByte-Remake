import type { DataTableColumn } from '$lib/components/table/types.js';
import type { PaginationOptions } from '@workspace/shared/types/database/index.js';
import { getContext, setContext } from 'svelte';

export type TablePageState = {
	size: number;
	total: number;
	current: number;

	nextPage: () => number;
	previousPage: () => number;
	visiblePages: () => number[];
};

export type TableColumnState = {
	configs: DataTableColumn[];
	hiddenColumns: Record<string, boolean>;

	hideColumn: (key: string) => void;
	showColumn: (key: string) => void;
	visibleColumns: () => DataTableColumn[];
	hideableColumns: () => DataTableColumn[];
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
		visiblePages: () => {
			const lower = Math.max(this.page.current - 1, 1);
			const upper = Math.min(this.page.current + 1, this.page.total);
			return Array.from({ length: upper - lower + 1 }, (_, i) => lower + i);
		}
	});

	columns: TableColumnState = $state({
		configs: [],
		hiddenColumns: {},

		hideColumn: (key) => {
			if (this.columns.configs.find((col) => col.key === key)?.hideable) {
				this.columns.hiddenColumns[key] = true;
			}
		},

		showColumn: (key) => {
			this.columns.hiddenColumns[key] = false;
		},

		visibleColumns: () => {
			return this.columns.configs.filter((col) => !this.columns.hiddenColumns[col.key]);
		},

		hideableColumns: () => {
			return this.columns.configs.filter((col) => col.hideable);
		}
	});

	globalSearch: string = $state('');
	getGlobalSearchFields() {
		return this.columns.configs.filter((col) => col.searchable).map((col) => col.title);
	}

	getURLState(): TableURLState {
		return {
			page: this.page.current,
			size: this.page.size,

			filters: {},
			filterMap: {},
			sorting: {},

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
