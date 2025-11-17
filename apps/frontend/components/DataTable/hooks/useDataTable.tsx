"use client";

import {
    useReactTable,
    getCoreRowModel,
    getSortedRowModel,
    getPaginationRowModel,
    getFilteredRowModel,
    ColumnDef,
    SortingState,
    ColumnFiltersState,
    VisibilityState,
    RowSelectionState,
} from "@tanstack/react-table";
import { useState, useMemo, useEffect } from "react";
import { DataTableColumn, TableView, TableFilter, FilterField } from "../types";
import { getNestedValue } from "../utils/nested";
import { useDataTableFilters } from "./useDataTableFilters";
import { useDataTableURL } from "./useDataTableURL";
import { applyFilters } from "../utils/filters";
import { Checkbox } from "@workspace/ui/components/checkbox";

interface UseDataTableProps<TData> {
    data: TData[];
    columns: DataTableColumn<TData>[];
    enableRowSelection?: boolean;
    enableFilters?: boolean;
    enablePagination?: boolean;
    enableURLState?: boolean;
    views?: TableView[];
    filterFields?: FilterField[];
    controlledFilters?: TableFilter[];
    onFiltersChange?: (filters: TableFilter[]) => void;
    onSelectionChange?: (rows: TData[]) => void;
}

/**
 * Main hook for DataTable - integrates TanStack Table with custom features
 */
export function useDataTable<TData>({
    data,
    columns,
    enableRowSelection,
    enableFilters,
    enablePagination,
    enableURLState,
    views,
    controlledFilters,
    onFiltersChange,
    onSelectionChange,
}: UseDataTableProps<TData>) {
    const { urlState, updateURL } = useDataTableURL();

    // Initialize filters from URL or controlled filters
    const initialFilters = controlledFilters || urlState.filters;
    const filterHook = useDataTableFilters({ views, initialFilters });

    // Sync view from URL on mount
    useEffect(() => {
        if (urlState.view && views) {
            filterHook.applyView(urlState.view);
        }
    }, []); // Only run on mount

    const [sorting, setSorting] = useState<SortingState>([]);
    const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
    const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
    const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
    const [globalFilter, setGlobalFilter] = useState(urlState.globalSearch);

    // Apply custom filters to data
    const filteredData = useMemo(() => {
        return applyFilters(data, filterHook.combinedFilters);
    }, [data, filterHook.combinedFilters]);

    // Convert DataTableColumn[] to TanStack ColumnDef[]
    const tanstackColumns: ColumnDef<TData>[] = useMemo(() => {
        const cols: ColumnDef<TData>[] = [];

        // Add selection column if enabled
        if (enableRowSelection) {
            cols.push({
                id: "select",
                header: ({ table }) => (
                    <Checkbox
                        checked={table.getIsAllPageRowsSelected()}
                        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
                        aria-label="Select all"
                    />
                ),
                cell: ({ row }) => (
                    <Checkbox
                        checked={row.getIsSelected()}
                        onCheckedChange={(value) => row.toggleSelected(!!value)}
                        aria-label="Select row"
                    />
                ),
                enableSorting: false,
                enableHiding: false,
                size: 40,
            });
        }

        // Add data columns
        columns.forEach((col) => {
            cols.push({
                id: col.key,
                accessorFn: (row) => getNestedValue(row, col.key),
                header: typeof col.header === "function" ? col.header : () => col.header || col.title,
                cell: col.cell
                    ? ({ row }) => col.cell!({ row: row.original, value: getNestedValue(row.original, col.key) })
                    : undefined,
                enableSorting: col.sortable ?? true,
                enableHiding: col.hideable ?? true,
                size: col.width ? parseInt(col.width) : undefined,
            });
        });

        return cols;
    }, [columns, enableRowSelection]);

    // Local pagination state (TanStack Table requires controlled state pattern)
    const [pagination, setPagination] = useState({
        pageIndex: urlState.page - 1,
        pageSize: urlState.pageSize,
    });

    // Initialize TanStack Table
    const table = useReactTable({
        data: filteredData,
        columns: tanstackColumns,
        state: {
            sorting,
            columnFilters,
            columnVisibility,
            rowSelection,
            globalFilter,
            pagination,
        },
        onSortingChange: setSorting,
        onColumnFiltersChange: setColumnFilters,
        onColumnVisibilityChange: setColumnVisibility,
        onRowSelectionChange: setRowSelection,
        onGlobalFilterChange: setGlobalFilter,
        onPaginationChange: setPagination,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        enableRowSelection: enableRowSelection,
        manualPagination: false,
        globalFilterFn: (row, columnId, filterValue) => {
            // Search across searchable columns
            const searchableColumns = columns.filter(c => c.searchable);
            return searchableColumns.some(col => {
                const value = getNestedValue(row.original, col.key);
                return value?.toString().toLowerCase().includes(filterValue.toLowerCase());
            });
        },
    });

    // Sync filters with parent
    useEffect(() => {
        if (onFiltersChange) {
            onFiltersChange(filterHook.combinedFilters);
        }
    }, [filterHook.combinedFilters, onFiltersChange]);

    // Sync URL with table state
    useEffect(() => {
        if (!enableURLState) return;

        updateURL({
            page: pagination.pageIndex + 1,
            pageSize: pagination.pageSize,
            globalSearch: globalFilter,
            filters: filterHook.combinedFilters,
            view: filterHook.activeView?.id,
        });
    }, [
        enableURLState,
        pagination.pageIndex,
        pagination.pageSize,
        globalFilter,
        filterHook.combinedFilters,
        filterHook.activeView,
        updateURL,
    ]);

    // Get selected rows
    const selectedRows = useMemo(() => {
        return table.getSelectedRowModel().rows.map(row => row.original);
    }, [table.getSelectedRowModel().rows]);

    // Call onSelectionChange when selection changes
    useEffect(() => {
        if (onSelectionChange) {
            onSelectionChange(selectedRows);
        }
    }, [selectedRows, onSelectionChange]);

    // Get searchable field names for display
    const searchableFields = useMemo(() => {
        return columns.filter(c => c.searchable).map(c => c.title);
    }, [columns]);

    return {
        table,
        globalSearch: globalFilter,
        setGlobalSearch: setGlobalFilter,
        filters: filterHook.filters,
        activeView: filterHook.activeView,
        setActiveView: filterHook.setActiveView,
        addFilter: filterHook.addFilter,
        removeFilter: filterHook.removeFilter,
        clearFilters: filterHook.clearFilters,
        selectedRows,
        viewFilters: filterHook.activeView?.filters || [],
    };
}
