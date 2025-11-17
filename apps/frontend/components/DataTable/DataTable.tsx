"use client";

import { flexRender } from "@tanstack/react-table";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@workspace/ui/components/table";
import { DataTableProps } from "./types";
import { useDataTable } from "./hooks/useDataTable";
import { DataTableToolbar } from "./DataTableToolbar";
import { DataTablePagination } from "./DataTablePagination";
import { Button } from "@workspace/ui/components/button";
import { cn } from "@/lib/utils";

export function DataTable<TData>({
    data,
    columns,
    enableRowSelection = false,
    enableGlobalSearch = true,
    enableFilters = true,
    enablePagination = true,
    enableColumnToggle = true,
    enableURLState = true,
    views = [],
    rowActions = [],
    onRowClick,
    onSelectionChange,
    controlledFilters,
    onFiltersChange,
    className,
}: DataTableProps<TData>) {
    const {
        table,
        globalSearch,
        setGlobalSearch,
        filters,
        activeView,
        setActiveView,
        addFilter,
        removeFilter,
        clearFilters,
        selectedRows,
        viewFilters,
    } = useDataTable({
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
    });

    const hasSelectedRows = selectedRows.length > 0;

    return (
        <div className={cn(className, "flex flex-col size-full overflow-hidden")}>
            {/* Toolbar */}
            <div className="mb-4">
                <DataTableToolbar
                    table={table}
                    columns={columns}
                    globalSearch={globalSearch}
                    onGlobalSearchChange={enableGlobalSearch ? setGlobalSearch : undefined}
                    filters={filters}
                    viewFilters={viewFilters}
                    onAddFilter={enableFilters ? addFilter : undefined}
                    onRemoveFilter={enableFilters ? removeFilter : undefined}
                    onClearFilters={enableFilters ? clearFilters : undefined}
                    views={views}
                    activeView={activeView}
                    onViewChange={setActiveView}
                    showColumnToggle={enableColumnToggle}
                />
            </div>

            {/* Bulk Actions */}
            {hasSelectedRows && rowActions.length > 0 && (
                <div className="mb-4 flex items-center gap-2 rounded-md border border-muted bg-muted/50 p-2">
                    <span className="text-sm font-medium">
                        {selectedRows.length} row{selectedRows.length !== 1 ? "s" : ""} selected
                    </span>
                    <div className="flex gap-2">
                        {rowActions.map((action, index) => (
                            <Button
                                key={index}
                                variant={action.variant || "outline"}
                                size="sm"
                                onClick={() => action.onClick(selectedRows)}
                            >
                                {action.icon && <span className="mr-2">{action.icon}</span>}
                                {action.label}
                            </Button>
                        ))}
                    </div>
                </div>
            )}

            {/* Table */}
            <div className="flex size-full rounded-md border overflow-hidden">
                <Table>
                    <TableHeader>
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id}>
                                {headerGroup.headers.map((header) => (
                                    <TableHead key={header.id}>
                                        {header.isPlaceholder
                                            ? null
                                            : flexRender(header.column.columnDef.header, header.getContext())}
                                    </TableHead>
                                ))}
                            </TableRow>
                        ))}
                    </TableHeader>
                    <TableBody>
                        {table.getRowModel().rows?.length ? (
                            table.getRowModel().rows.map((row) => (
                                <TableRow
                                    key={row.id}
                                    data-state={row.getIsSelected() && "selected"}
                                    className={onRowClick ? "cursor-pointer" : undefined}
                                    onClick={(e) => {
                                        // Don't trigger row click if clicking on checkbox or action buttons
                                        if (
                                            onRowClick &&
                                            !(e.target as HTMLElement).closest('input[type="checkbox"]') &&
                                            !(e.target as HTMLElement).closest("button")
                                        ) {
                                            onRowClick(row.original);
                                        }
                                    }}
                                >
                                    {row.getVisibleCells().map((cell) => (
                                        <TableCell key={cell.id}>
                                            {flexRender(cell.column.columnDef.cell || cell.renderValue, cell.getContext())}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={enableRowSelection ? columns.length + 1 : columns.length} className="h-full text-center">
                                    No results.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Pagination */}
            {enablePagination && (
                <div className="mt-4">
                    <DataTablePagination table={table} />
                </div>
            )}
        </div>
    );
}
