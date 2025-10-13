import type { Component, Snippet } from 'svelte';
import z from 'zod';

export type DataTableCell<T> = {
	row: T;
	column: DataTableColumn<T>;
};

export type DataTableColumn<T> = {
	key: string;
	title: string;

	render?: (cell: DataTableCell<T>) => string;
	cell?: Snippet<[DataTableCell<T>]>;

	sort?: (rowA: T, rowB: T, dir: 'asc' | 'desc') => number;

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

export const DataTableURLStateSchema = z.object({
	page: z.string().default('1'),
	size: z.string().default('50'),

	globalSearch: z.string().default(''),
	sort: z.string().default('')
});

export type DataTableURLState = z.infer<typeof DataTableURLStateSchema>;
