import {
	DataTableURLStateSchema,
	type DataTableColumn,
	type TableFilter,
	type TableView,
	type FilterField,
	deserializeFilters,
	serializeFilters,
	convertToDynamicCrudFilters
} from '$lib/components/table/types.js';
import { useSearchParams } from 'runed/kit';
import { getContext, setContext } from 'svelte';

/**
 * Gets a nested value from an object using dot notation
 * @param obj - The object to traverse
 * @param path - The path to the value (e.g., 'normalizedData.status' or 'user.profile.name')
 * @returns The value at the path, or undefined if not found
 *
 * @example
 * const entity = { normalizedData: { status: 'active', name: 'Test' } };
 * getNestedValue(entity, 'normalizedData.status') // 'active'
 * getNestedValue(entity, 'normalizedData.missing') // undefined
 */
function getNestedValue(obj: any, path: string): any {
	if (!obj || !path) return undefined;

	// Handle simple (non-nested) paths quickly
	if (!path.includes('.')) {
		return obj[path];
	}

	// Handle nested paths
	const keys = path.split('.');
	let current = obj;

	for (const key of keys) {
		if (current === null || current === undefined) {
			return undefined;
		}
		current = current[key];
	}

	return current;
}

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

export interface TableState {
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

	// Filter system
	filters: TableFilter[];
	filterFields?: FilterField[]; // Optional standalone filter definitions
	addFilter: (filter: TableFilter) => void;
	removeFilter: (index: number) => void;
	clearFilters: () => void;
	updateFilter: (index: number, filter: TableFilter) => void;

	// Views system
	views: TableView[];
	activeView?: TableView;
	applyView: (viewName: string) => void;
	clearView: () => void;

	clearAll: () => void;

	// Combined filters for dynamicList
	getCombinedFilters: () => any;
	getDynamicCrudFilters: () => any;
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

			const sort = this.params.sort ? this.params.sort.split(':') : undefined;
			this.columns.sortedColumn = sort ? [sort[0], sort[1] as any] : undefined;

			// Sync filters from URL with column type information
			this.filters = deserializeFilters(this.params.filters, this.columns.configs);

			// Sync active view from URL
			if (this.params.view) {
				const view = this.views.find((v) => v.name === this.params.view);
				if (view) {
					this.activeView = view;
				}
			} else {
				this.activeView = undefined;
			}
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
				const searchableColumns = this.columns.configs.filter((col) => col.searchable);

				// Check each searchable column (supports nested keys via dot notation)
				return searchableColumns.some((col) => {
					const val = getNestedValue(row, col.key);
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

		// Generic fallback sort (supports nested keys via dot notation)
		return rows.sort((a, b) => {
			const valA = getNestedValue(a, sortedKey);
			const valB = getNestedValue(b, sortedKey);

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

	// ============================================================================
	// FILTER SYSTEM
	// ============================================================================

	filters: TableFilter[] = $state([]);
	filterFields?: FilterField[] = $state(undefined);
	views: TableView[] = $state([]);
	activeView?: TableView = $state(undefined);

	addFilter = (filter: TableFilter) => {
		const currentFilters = deserializeFilters(this.params.filters, this.columns.configs);
		const newFilters = [...currentFilters, filter];
		this.params.update({ filters: serializeFilters(newFilters), page: '2' });
	};

	removeFilter = (index: number) => {
		const currentFilters = deserializeFilters(this.params.filters, this.columns.configs);
		const newFilters = currentFilters.filter((_, i) => i !== index);
		this.params.update({ filters: serializeFilters(newFilters), page: '1' });
	};

	clearFilters = () => {
		this.params.update({ filters: undefined, page: '1' });
	};

	updateFilter = (index: number, filter: TableFilter) => {
		const currentFilters = deserializeFilters(this.params.filters, this.columns.configs);
		const newFilters = currentFilters.map((f, i) => (i === index ? filter : f));
		this.params.update({ filters: serializeFilters(newFilters), page: '1' });
	};

	applyView = (viewName: string) => {
		const view = this.views.find((v) => v.name === viewName);
		if (view) {
			this.params.update({ view: viewName, page: '1' });
		}
	};

	clearView = () => {
		this.params.update({ view: undefined, page: '1' });
	};

	clearAll = () => {
		this.params.update({ filters: undefined, view: undefined, page: '1' });
	};

	/**
	 * Get combined filters from both active view and dynamic filters
	 */
	getCombinedFilters = (): TableFilter[] => {
		const viewFilters = this.activeView?.filters || [];
		return [...viewFilters, ...this.filters];
	};

	/**
	 * Convert table filters to dynamicCrud format for Convex queries
	 */
	getDynamicCrudFilters = () => {
		const combined = this.getCombinedFilters();
		return convertToDynamicCrudFilters(combined);
	};
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
