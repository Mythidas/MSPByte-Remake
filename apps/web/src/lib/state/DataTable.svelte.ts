import { DataTableURLStateSchema, type DataTableColumn } from '$lib/components/table/types.js';
import { useSearchParams } from 'runed/kit';
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
	setSize: (size: number) => void;
};

export type TableColumnState = {
	configs: DataTableColumn<any>[];
	hiddenColumns: Record<string, boolean>;
	sortedColumn?: [string, 'asc' | 'desc'];

	visibleColumns: () => DataTableColumn<any>[];
	hideableColumns: () => DataTableColumn<any>[];

	toggleColumn: (key: string, value?: boolean) => void;
	sortColumn: (key: string) => void;
};

interface TableState {
	data: any[];

	page: TablePageState;
	columns: TableColumnState;

	getRows: () => any[];
	getPaginatedRows: (rows?: any[]) => any[];
	getFilteredRows: (rows?: any[]) => any[];
	getSortedRows: (rows?: any[]) => any[];

	globalSearch: string;
	setGlobalSearch: (val: string) => void;
	getGlobalSearchFields: () => string[];
}

class TableStateClass implements TableState {
	params = useSearchParams(DataTableURLStateSchema);

	constructor() {
		$effect(() => {
			this.page.total = Math.max(1, Math.ceil(this.getFilteredRows().length / this.page.size));
		});

		$effect(() => {
			this.page.current = Math.min(parseInt(this.params.page), this.page.total);
			this.page.size = parseInt(this.params.size);

			this.globalSearch = this.params.globalSearch;

			const sort = this.params.sort ? this.params.sort.split(':') : undefined;
			this.columns.sortedColumn = sort ? [sort[0], sort[1] as any] : undefined;
		});
	}

	data = $state([]);

	page: TablePageState = $state({
		size: 50,
		total: this.data.length,
		current: 1,

		previousPage: () => {
			this.page.current = Math.max(this.page.current - 1, 1);
			this.params.update({ page: String(this.page.current) });
			return this.page.current;
		},
		nextPage: () => {
			this.page.current = Math.min(this.page.current + 1, this.page.total);
			this.params.update({ page: String(this.page.current) });
			return this.page.current;
		},
		firstPage: () => {
			this.page.current = 1;
			this.params.update({ page: String(this.page.current) });
			return this.page.current;
		},
		lastPage: () => {
			this.page.current = this.page.total;
			this.params.update({ page: String(this.page.current) });
			return this.page.current;
		},
		visiblePages: () => {
			const current = this.page.current;
			const lower = Math.max(current === this.page.total ? current - 2 : current - 1, 1);
			const upper = Math.min(current === 1 ? 3 : current + 1, this.page.total);
			return Array.from({ length: upper - lower + 1 }, (_, i) => lower + i);
		},
		setSize: (size) => {
			this.page.size = size;
			this.page.current = Math.min(this.page.current, this.page.total);
			this.params.update({ size: String(size), page: String(this.page.current) });
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

			this.params.update({
				sort: this.columns.sortedColumn ? `${key}:${this.columns.sortedColumn[1]}` : ''
			});
		}
	});

	getRows = () => {
		return this.getPaginatedRows(this.getSortedRows(this.getFilteredRows()));
	};

	getPaginatedRows = (data?: any[]) => {
		const rows = [...(data || this.data)];
		return rows.slice((this.page.current - 1) * this.page.size, this.page.current * this.page.size);
	};

	getFilteredRows = (data?: any[]) => {
		const rows = [...(data || this.data)];

		return rows.filter((row) => {
			if (this.globalSearch) {
				const lowerSearch = this.globalSearch.toLowerCase();
				const globalFields = this.columns.configs
					.filter((col) => col.searchable)
					.map((col) => col.key);

				return Object.entries(row).some(([key, val]) => {
					if (!globalFields.includes(key)) return false;
					if (typeof val !== 'string') return false;

					return val.toLowerCase().includes(lowerSearch);
				});
			}

			return true;
		});
	};

	getSortedRows = (data?: any[]) => {
		const rows = [...(data || this.data)];
		if (!this.columns.sortedColumn) return rows;

		const [sortedKey, direction = 'asc'] = this.columns.sortedColumn;
		const sortFn = this.columns.configs.find((col) => col.key === sortedKey)?.sort;

		if (sortFn) {
			return rows.sort((a, b) => sortFn(a, b, direction));
		}

		// Generic fallback sort
		return rows.sort((a, b) => {
			const valA = a[sortedKey];
			const valB = b[sortedKey];

			// Handle undefined/null
			if (valA == null && valB == null) return 0;
			if (valA == null) return direction === 'asc' ? -1 : 1;
			if (valB == null) return direction === 'asc' ? 1 : -1;

			// Compare numbers
			if (typeof valA === 'number' && typeof valB === 'number') {
				return direction === 'asc' ? valA - valB : valB - valA;
			}

			// Compare strings (case-insensitive)
			const strA = String(valA).toLowerCase();
			const strB = String(valB).toLowerCase();

			if (strA < strB) return direction === 'asc' ? -1 : 1;
			if (strA > strB) return direction === 'asc' ? 1 : -1;
			return 0;
		});
	};

	globalSearch: string = $state('');
	setGlobalSearch = (val: string) => {
		this.globalSearch = val;
		this.params.update({ globalSearch: val });
	};
	getGlobalSearchFields() {
		return this.columns.configs.filter((col) => col.searchable).map((col) => col.title);
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
