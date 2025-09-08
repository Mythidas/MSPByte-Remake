import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { DataTableSort } from "@/lib/types/datatable";
import { ColumnDef, flexRender } from "@tanstack/react-table";
import { RefreshCw } from "lucide-react";

export default function DataTableBody<T extends Record<string, any>>({
  table,
  loading,
  error,
  tableColumns,
  loadingComponent,
  emptyMessage,
  onRowClick,
  columns,
  sorts,
  handleSort,
}: {
  table: any;
  loading: boolean;
  error: string | null;
  tableColumns: ColumnDef<T>[];
  loadingComponent?: React.ReactNode;
  emptyMessage: string;
  onRowClick?: (row: T) => void;
  columns: any[];
  sorts: DataTableSort[];
  handleSort: (columnKey: string) => void;
}) {
  return (
    <div className="border rounded-md">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup: any) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header: any) => {
                const column = columns.find((col) => col.key === header.id);
                const currentSort = sorts.find(
                  (sort) => sort.column === header.id
                );

                return (
                  <TableHead
                    key={header.id}
                    className={
                      column?.sortable ? "cursor-pointer select-none" : ""
                    }
                    onClick={() => {
                      if (column?.sortable) {
                        handleSort(header.id);
                      }
                    }}
                  >
                    {header.isPlaceholder ? null : (
                      <div className="flex items-center gap-2">
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                        {currentSort && (
                          <span className="text-xs">
                            {currentSort.direction === "desc" ? "↓" : "↑"}
                          </span>
                        )}
                      </div>
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell
                colSpan={tableColumns.length}
                className="text-center py-8"
              >
                {loadingComponent || (
                  <div className="flex items-center justify-center gap-2">
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Loading...
                  </div>
                )}
              </TableCell>
            </TableRow>
          ) : error ? (
            <TableRow>
              <TableCell
                colSpan={tableColumns.length}
                className="text-center text-red-500 py-8"
              >
                Error: {error}
              </TableCell>
            </TableRow>
          ) : table.getRowModel().rows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={tableColumns.length}
                className="text-center py-8"
              >
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            table.getRowModel().rows.map((row: any) => (
              <TableRow
                key={row.id}
                className={onRowClick ? "cursor-pointer" : ""}
                onClick={(e) => {
                  // Don't trigger row click if clicking on checkbox or action buttons
                  if (
                    e.target instanceof HTMLElement &&
                    (e.target.closest("[data-checkbox]") ||
                      e.target.closest("[data-action]"))
                  ) {
                    return;
                  }
                  onRowClick?.(row.original);
                }}
                data-state={row.getIsSelected() && "selected"}
              >
                {row.getVisibleCells().map((cell: any) => (
                  <TableCell
                    key={cell.id}
                    data-checkbox={
                      cell.column.id === "select" ? true : undefined
                    }
                    data-action={
                      cell.column.id === "actions" ? true : undefined
                    }
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
