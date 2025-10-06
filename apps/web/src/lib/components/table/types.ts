import type { Component } from 'svelte';

export type DataTableCell = {
	row: any;
};

export type DataTableColumn = {
	key: string;
	title: string;

	render?: (cell: DataTableCell) => string;

	sortable?: boolean;
	hideable?: boolean;
	searchable?: boolean;
};

export type DataTableFilter = {};
