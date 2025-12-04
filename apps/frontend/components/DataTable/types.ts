import { ColumnDef as TanStackColumnDef } from "@tanstack/react-table";
import { ReactNode } from "react";

// Filter operators
export type FilterOperator =
    | "eq" // equals
    | "ne" // not equals
    | "gt" // greater than
    | "gte" // greater than or equal
    | "lt" // less than
    | "lte" // less than or equal
    | "in" // in array
    | "nin" // not in array
    | "contains" // string contains
    | "startsWith" // string starts with
    | "endsWith"; // string ends with

// Filter structure
export interface TableFilter {
    field: string;
    operator: FilterOperator;
    value: any;
}

// Filter configuration for columns
export interface FilterConfig {
    label?: string; // Custom label in filter builder
    type: "text" | "select" | "date" | "number" | "boolean";
    operators: FilterOperator[];
    defaultOperator?: FilterOperator;
    options?: { label: string; value: any }[]; // For select component
    placeholder?: string;
    multiple?: boolean; // For multi-select with 'in' operator
}

// Column definition (extends TanStack but adds custom properties)
export interface DataTableColumn<TData> {
    key: string; // Field path (supports dot notation like "normalizedData.name")
    title: string; // Column header text

    // Rendering
    cell?: (context: { row: TData; value: any }) => ReactNode;
    header?: ReactNode | (() => ReactNode);

    // Export
    exportValue?: (context: { row: TData; value: any }) => string | number | boolean | null;

    // Sorting
    sortable?: boolean;
    sortFn?: (rowA: TData, rowB: TData, direction: "asc" | "desc") => number;

    // Features
    searchable?: boolean; // Include in global search
    hideable?: boolean; // Can be hidden via column visibility
    width?: string; // Column width (CSS value or number)

    // Filtering
    filter?: FilterConfig;
}

// Standalone filter field (not tied to a column)
export interface FilterField {
    key: string; // Field path
    label: string; // Display name
    config: FilterConfig;
}

// View definition (predefined filter sets)
export interface TableView {
    id: string; // Unique identifier
    label: string; // Display name
    description?: string;
    icon?: React.ComponentType<{ className?: string }>;
    filters: TableFilter[];
    isDefault?: boolean;
}

// Row action for bulk operations
export interface RowAction<TData> {
    label: string;
    icon?: ReactNode;
    onClick: (rows: TData[]) => void | Promise<void>;
    variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
    disabled?: (rows: TData[]) => boolean;
}

// Main DataTable component props
export interface DataTableProps<TData> {
    data: TData[];
    columns: DataTableColumn<TData>[];

    // Features
    enableRowSelection?: boolean;
    enableGlobalSearch?: boolean;
    enableFilters?: boolean;
    enablePagination?: boolean;
    enableColumnToggle?: boolean;
    enableURLState?: boolean;

    // Filtering
    views?: TableView[];
    filterFields?: FilterField[];
    controlledFilters?: TableFilter[]; // Controlled filters
    onFiltersChange?: (filters: TableFilter[]) => void;

    // Row selection
    rowActions?: RowAction<TData>[];
    onSelectionChange?: (rows: TData[]) => void;
    onFilteredDataChange?: (filteredData: TData[]) => void; // Called when filtered data changes

    // Row interaction
    onRowClick?: (row: TData) => void;

    // Misc
    isLoading?: boolean;
    emptyMessage?: string;
    className?: string;
}

// Internal URL state structure
export interface URLState {
    page: number;
    pageSize: number;
    globalSearch: string;
    sortBy: string; // Format: "field:asc" or "field:desc"
    filters: TableFilter[];
    view: string;
}
