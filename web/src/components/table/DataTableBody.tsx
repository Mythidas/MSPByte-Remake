"use client";

import { useCallback, useMemo } from "react";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { DataTableColumn, DataTableSort } from "@/lib/types/datatable";

interface DataTableBodyProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  sorts: DataTableSort[];
  hiddenColumns: string[];
  isLoading?: boolean;
  enableSelection?: boolean;
  selectedRows?: T[];
  onSortChange?: (sorts: DataTableSort[]) => void;
  onRowClick?: (row: T) => void;
  onSelectionChange?: (selectedRows: T[]) => void;
  emptyMessage?: string;
  loadingComponent?: React.ReactNode;
  getRowId?: (row: T) => string;
  className?: string;
}

export function DataTableBody<T>({
  columns,
  data,
  sorts,
  hiddenColumns = [],
  isLoading = false,
  enableSelection = false,
  selectedRows = [],
  onSortChange,
  onRowClick,
  onSelectionChange,
  emptyMessage = "No data available",
  loadingComponent,
  getRowId = (row: T) => JSON.stringify(row),
  className,
}: DataTableBodyProps<T>) {
  // Filter visible columns
  const visibleColumns = useMemo(() => {
    return columns.filter((col) => !hiddenColumns.includes(String(col.key)));
  }, [columns, hiddenColumns]);

  // Handle sorting
  const handleSort = useCallback(
    (columnKey: string) => {
      if (!onSortChange) return;

      const existingSort = sorts.find((sort) => sort.column === columnKey);

      if (!existingSort) {
        // Add new sort
        onSortChange([{ column: columnKey, direction: "asc" }]);
      } else if (existingSort.direction === "asc") {
        // Change to desc
        onSortChange([{ column: columnKey, direction: "desc" }]);
      } else {
        // Remove sort
        onSortChange(sorts.filter((sort) => sort.column !== columnKey));
      }
    },
    [sorts, onSortChange]
  );

  // Handle row selection
  const isRowSelected = useCallback(
    (row: T): boolean => {
      const rowId = getRowId(row);
      return selectedRows.some(
        (selectedRow) => getRowId(selectedRow) === rowId
      );
    },
    [selectedRows, getRowId]
  );

  const handleRowSelection = useCallback(
    (row: T, checked: boolean) => {
      if (!onSelectionChange) return;

      const rowId = getRowId(row);

      if (checked) {
        // Add row to selection
        if (!isRowSelected(row)) {
          onSelectionChange([...selectedRows, row]);
        }
      } else {
        // Remove row from selection
        onSelectionChange(
          selectedRows.filter((selectedRow) => getRowId(selectedRow) !== rowId)
        );
      }
    },
    [selectedRows, onSelectionChange, getRowId, isRowSelected]
  );

  const handleSelectAll = useCallback(
    (checked: boolean) => {
      if (!onSelectionChange) return;

      if (checked) {
        // Select all visible rows that aren't already selected
        const newSelections = data.filter((row) => !isRowSelected(row));
        onSelectionChange([...selectedRows, ...newSelections]);
      } else {
        // Deselect all visible rows
        const visibleRowIds = data.map(getRowId);
        onSelectionChange(
          selectedRows.filter((row) => !visibleRowIds.includes(getRowId(row)))
        );
      }
    },
    [data, selectedRows, onSelectionChange, getRowId, isRowSelected]
  );

  // Check if all visible rows are selected
  const allVisibleSelected = useMemo(() => {
    return data.length > 0 && data.every((row) => isRowSelected(row));
  }, [data, isRowSelected]);

  const someVisibleSelected = useMemo(() => {
    return data.some((row) => isRowSelected(row));
  }, [data, isRowSelected]);

  // Render cell content
  const renderCellContent = useCallback(
    (column: DataTableColumn<T>, row: T) => {
      const rawValue = row[column.key as keyof T];
      const value = String(rawValue ?? "");

      if (column.render) {
        return column.render(value, row);
      }

      return value;
    },
    []
  );

  // Get sort icon
  const getSortIcon = useCallback(
    (columnKey: string) => {
      const sort = sorts.find((s) => s.column === columnKey);
      if (!sort) return <ArrowUpDown className="h-4 w-4" />;

      return sort.direction === "asc" ? (
        <ArrowUp className="h-4 w-4" />
      ) : (
        <ArrowDown className="h-4 w-4" />
      );
    },
    [sorts]
  );

  // Render loading state
  if (isLoading) {
    if (loadingComponent) {
      return <div className={className}>{loadingComponent}</div>;
    }

    return (
      <div className={cn("flex-1 overflow-hidden", className)}>
        <ScrollArea className="h-full">
          <Table>
            <TableHeader>
              <TableRow>
                {enableSelection && (
                  <TableHead className="w-12">
                    <Skeleton className="h-4 w-4" />
                  </TableHead>
                )}
                {visibleColumns.map((column) => (
                  <TableHead
                    key={String(column.key)}
                    style={{ width: column.width }}
                  >
                    <Skeleton className="h-4 w-20" />
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 10 }).map((_, i) => (
                <TableRow key={i}>
                  {enableSelection && (
                    <TableCell>
                      <Skeleton className="h-4 w-4" />
                    </TableCell>
                  )}
                  {visibleColumns.map((column) => (
                    <TableCell key={String(column.key)}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </div>
    );
  }

  // Render empty state
  if (data.length === 0) {
    return (
      <div
        className={cn("flex-1 flex items-center justify-center p-8", className)}
      >
        <div className="text-center text-muted-foreground">
          <p className="text-sm">{emptyMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn("relative flex-1 overflow-hidden flex flex-col", className)}
    >
      {/* Fixed Header */}
      <div className="bg-background border-b">
        <Table className="table-fixed">
          <colgroup>
            {enableSelection && <col className="w-8" />}
            {visibleColumns.map((column) => (
              <col key={String(column.key)} style={{ width: column.width }} />
            ))}
          </colgroup>
          <TableHeader>
            <TableRow>
              {enableSelection && (
                <TableHead className="w-8">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    ref={(input) => {
                      if (input)
                        input.indeterminate =
                          someVisibleSelected && !allVisibleSelected;
                    }}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="rounded border border-input"
                  />
                </TableHead>
              )}
              {visibleColumns.map((column) => (
                <TableHead
                  key={String(column.key)}
                  className={
                    column.sortable !== false
                      ? "cursor-pointer select-none"
                      : ""
                  }
                >
                  {column.sortable !== false ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSort(String(column.key))}
                      className="h-auto p-0 font-medium hover:bg-transparent"
                    >
                      <span className="flex items-center gap-1">
                        {column.label}
                        {getSortIcon(String(column.key))}
                      </span>
                    </Button>
                  ) : (
                    column.label
                  )}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
        </Table>
      </div>

      {/* Scrollable Body */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <Table className="table-fixed">
            <colgroup>
              {enableSelection && <col className="w-8" />}
              {visibleColumns.map((column) => (
                <col key={String(column.key)} style={{ width: column.width }} />
              ))}
            </colgroup>
            <TableBody>
              {data.map((row) => {
                const rowId = getRowId(row);
                const selected = isRowSelected(row);

                return (
                  <TableRow
                    key={rowId}
                    className={cn(
                      "cursor-pointer",
                      selected && "bg-muted/50",
                      onRowClick && "hover:bg-muted/30"
                    )}
                    onClick={() => onRowClick?.(row)}
                  >
                    {enableSelection && (
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={(e) =>
                            handleRowSelection(row, e.target.checked)
                          }
                          className="rounded border border-input"
                        />
                      </TableCell>
                    )}
                    {visibleColumns.map((column) => (
                      <TableCell key={String(column.key)}>
                        {renderCellContent(column, row)}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </ScrollArea>
      </div>
    </div>
  );
}
