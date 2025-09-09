import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { DataTableSort } from "@/lib/types/datatable";
import { cn } from "@/lib/utils";
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
  height = "max-h-[50vh]",
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
  height?: string;
}) {
  return (
    <div className="flex flex-col size-full border rounded-md relative">
      <ScrollArea className={cn(height, "max-w-full")}>
        <Table>
          <TableHeader className="sticky top-0 bg-background border-b border-border z-10">
            {table.getHeaderGroups().map((headerGroup: any, index: number) => (
              <TableRow key={index}>
                {headerGroup.headers.map((header: any, index: number) => {
                  const column = columns.find((col) => col.key === header.id);
                  const currentSort = sorts.find(
                    (sort) => sort.column === header.id
                  );

                  return (
                    <TableHead
                      key={index}
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
          <TableBody className="divide-y-0">
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
              table.getRowModel().rows.map((row: any, index: number) => (
                <TableRow
                  key={row.id}
                  className={cn(
                    "group hover:bg-muted/50 transition-colors duration-150",
                    "border-b border-border/40 last:border-b-0",
                    index % 2 === 0 ? "bg-background" : "bg-muted/20",
                    onRowClick ? "cursor-pointer" : ""
                  )}
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
                  {row.getVisibleCells().map((cell: any, index: number) => (
                    <TableCell
                      key={index}
                      data-checkbox={
                        cell.column.id === "select" ? true : undefined
                      }
                      data-action={
                        cell.column.id === "actions" ? true : undefined
                      }
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </ScrollArea>
    </div>
  );
}
