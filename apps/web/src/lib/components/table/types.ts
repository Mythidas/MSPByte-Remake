import type { Component, Snippet } from 'svelte';

export type DataTableCell<T> = {
	row: T;
	column: DataTableColumn;
};

export type DataTableColumn = {
	key: string;
	title: string;

	render?: (cell: DataTableCell<any>) => string;
	cell?: Snippet<[DataTableCell<any>]>;

	sortable?: boolean;
	hideable?: boolean;
	searchable?: boolean;
	width?: string;
};

export type DataTableFilter = Record<string, any>;

export type SortDirection = 'asc' | 'desc';

export type DataTableSort = {
	column: string;
	direction: SortDirection;
};

export type InfiniteDataTableProps = {
	rows: any[];
	columns: DataTableColumn[];
	isLoading: boolean;
	isDone: boolean;
	onLoadMore: () => void;
	onSearch?: (query: string) => void;
	onSort?: (column: string, direction: SortDirection) => void;
	onFilter?: (filters: DataTableFilter) => void;
	rowHeight?: number; // For virtual scrolling, defaults to 53px
};
