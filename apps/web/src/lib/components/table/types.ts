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
};

export type DataTableFilter = {};
