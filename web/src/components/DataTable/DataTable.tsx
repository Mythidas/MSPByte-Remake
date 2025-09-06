"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  Suspense,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  RefreshCw,
  X,
  MoreHorizontal,
  Eye,
} from "lucide-react";
import {
  DataTableProps,
  DataTablePagination,
  DataTableFilter,
  DataTableSort,
  DataTableView,
} from "@/lib/types/datatable";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import { createClient } from "@/lib/supabase/client";
import {
  ColumnDef,
  useReactTable,
  getCoreRowModel,
  flexRender,
  RowSelectionState,
} from "@tanstack/react-table";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DataTableFilters } from "@/components/DataTable/DataTableFilters";

export function DataTable<T extends Record<string, any>>(
  props: DataTableProps<T>
) {
  return (
    <Suspense fallback={<DataTableFallback />}>
      <DataTableUrlProvider {...props} />
    </Suspense>
  );
}

function DataTableFallback() {
  return (
    <div className="space-y-4">
      {/* Toolbar skeleton */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-9 w-40 bg-gray-200 rounded animate-pulse" />
          <div className="h-9 w-24 bg-gray-200 rounded animate-pulse" />
          <div className="h-9 w-9 bg-gray-200 rounded animate-pulse" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 bg-gray-200 rounded animate-pulse" />
          <div className="h-9 w-9 bg-gray-200 rounded animate-pulse" />
        </div>
      </div>

      {/* Table skeleton */}
      <div className="border rounded-md">
        <div className="w-full">
          {/* Header skeleton */}
          <div className="border-b">
            <div className="flex">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="p-4 flex-1">
                  <div className="h-4 bg-gray-200 rounded animate-pulse" />
                </div>
              ))}
            </div>
          </div>
          {/* Rows skeleton */}
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="border-b last:border-b-0">
              <div className="flex">
                {Array.from({ length: 4 }).map((_, j) => (
                  <div key={j} className="p-4 flex-1">
                    <div className="h-4 bg-gray-100 rounded animate-pulse" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Pagination skeleton */}
      <div className="flex items-center justify-between">
        <div className="h-4 w-48 bg-gray-200 rounded animate-pulse" />
        <div className="flex items-center gap-2">
          <div className="h-9 w-16 bg-gray-200 rounded animate-pulse" />
          <div className="h-9 w-9 bg-gray-200 rounded animate-pulse" />
          <div className="h-4 w-20 bg-gray-200 rounded animate-pulse" />
          <div className="h-9 w-9 bg-gray-200 rounded animate-pulse" />
        </div>
      </div>
    </div>
  );
}

export function DataTableUrlProvider<T extends Record<string, any>>(
  props: DataTableProps<T>
) {
  const {
    columns,
    fetcher,
    initialFilters = [],
    initialSort = [],
    initialPageSize = 20,
    views = [],
    actions = [],
    useUrlState = false,
    urlStateKey = "dt",
    eventChannel,
    eventTable,
    enableSelection = false,
    enableRefresh = true,
    enableExport = true,
    enableColumnToggle = true,
    className,
    emptyMessage = "No data found",
    loadingComponent,
    onRowClick,
    onSelectionChange,
  } = props;

  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  // Refs for preventing unnecessary re-renders
  const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastFetchParamsRef = useRef<string>("");
  const isInitialLoadRef = useRef(true);

  // State
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<DataTablePagination>({
    page: 1,
    pageSize: initialPageSize,
    total: 0,
  });
  const [filters, setFilters] = useState<DataTableFilter[]>(initialFilters);
  const [sorts, setSorts] = useState<DataTableSort[]>(initialSort);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(
    new Set(columns.map((col) => col.key))
  );
  const [activeView, setActiveView] = useState<string | null>(null);
  const [pendingUrlState, setPendingUrlState] = useState<object | null>(null);

  // Get selected rows based on current row selection state
  const selectedRows = useMemo(() => {
    return Object.keys(rowSelection)
      .filter((index) => rowSelection[index])
      .map((index) => data[parseInt(index)])
      .filter((i) => !!i);
  }, [rowSelection, data]);

  // Call onSelectionChange when selection changes
  useEffect(() => {
    onSelectionChange?.(selectedRows);
  }, [selectedRows, onSelectionChange]);

  // URL state management with debouncing
  const updateUrlState = useCallback(
    (
      newState: Partial<{
        page: number;
        pageSize: number;
        filters: DataTableFilter[];
        sorts: DataTableSort[];
        view: string;
      }>
    ) => {
      if (!useUrlState) return;
      setPendingUrlState((prev) => ({ ...prev, ...newState }));
    },
    [useUrlState]
  );

  useEffect(() => {
    if (!pendingUrlState) return;

    const params = new URLSearchParams(searchParams.toString());
    const stateKey = urlStateKey;

    const currentState = params.get(stateKey)
      ? JSON.parse(decodeURIComponent(params.get(stateKey)!))
      : {};

    const updatedState = { ...currentState, ...pendingUrlState };
    params.set(stateKey, encodeURIComponent(JSON.stringify(updatedState)));

    router.push(`?${params.toString()}`, { scroll: false });

    // Clear after applying so it doesn’t loop
    setPendingUrlState(null);
  }, [pendingUrlState, urlStateKey, searchParams, router]);

  // Initialize from URL state (only once)
  useEffect(() => {
    if (!useUrlState || !isInitialLoadRef.current) return;

    const params = new URLSearchParams(searchParams.toString());
    const stateParam = params.get(urlStateKey);

    if (stateParam) {
      try {
        const state = JSON.parse(decodeURIComponent(stateParam));

        // Batch all state updates to prevent multiple re-renders
        const updates: any = {};

        if (state.page || state.pageSize) {
          updates.pagination = {
            page: state.page || 1,
            pageSize: state.pageSize || initialPageSize,
            total: 0,
          };
        }

        if (state.filters) updates.filters = state.filters;
        if (state.sorts) updates.sorts = state.sorts;
        if (state.view) updates.activeView = state.view;

        // Apply all updates at once
        if (updates.pagination) setPagination(updates.pagination);
        if (updates.filters) setFilters(updates.filters);
        if (updates.sorts) setSorts(updates.sorts);
        if (updates.activeView) setActiveView(updates.activeView);
      } catch (e) {
        console.warn("Failed to parse URL state:", e);
      }
    }

    isInitialLoadRef.current = false;
  }, [useUrlState, urlStateKey, searchParams, initialPageSize]);

  // Debounced fetch function to prevent multiple rapid calls
  const debouncedFetch = useCallback(
    async (params: {
      page: number;
      pageSize: number;
      filters: DataTableFilter[];
      sorts: DataTableSort[];
    }) => {
      // Create a unique key for this fetch request
      const fetchKey = JSON.stringify(params);

      // If this is the same as the last fetch, skip it
      if (fetchKey === lastFetchParamsRef.current) {
        return;
      }

      lastFetchParamsRef.current = fetchKey;

      // Clear any pending fetch
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }

      // Only show loading for initial load or when data changes significantly
      const isNewFilter =
        params.filters.length !== filters.length ||
        JSON.stringify(params.filters) !== JSON.stringify(filters);
      const isNewSort = JSON.stringify(params.sorts) !== JSON.stringify(sorts);

      if (isInitialLoadRef.current || isNewFilter || isNewSort) {
        setLoading(true);
      }

      setError(null);

      try {
        const result = await fetcher(params);

        if (result.error) {
          setError(result.error);
        } else {
          setData(result.data);
          setPagination((prev) => ({ ...prev, total: result.count }));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch data");
      } finally {
        setLoading(false);
      }
    },
    [fetcher, filters, sorts]
  );

  // Memoized fetch parameters to prevent unnecessary re-renders
  const fetchParams = useMemo(
    () => ({
      page: pagination.page,
      pageSize: pagination.pageSize,
      filters,
      sorts,
    }),
    [pagination.page, pagination.pageSize, filters, sorts]
  );

  // Single effect for data fetching with debouncing
  useEffect(() => {
    // Clear any pending timeout
    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current);
    }

    // For initial load, fetch immediately
    if (isInitialLoadRef.current) {
      debouncedFetch(fetchParams);
      return;
    }

    // For subsequent updates, debounce to prevent rapid API calls
    fetchTimeoutRef.current = setTimeout(() => {
      debouncedFetch(fetchParams);
    }, 150); // Small delay to batch rapid changes

    return () => {
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
    };
  }, [fetchParams, debouncedFetch]);

  // Reset row selection when data changes (new page, filters, etc.)
  useEffect(() => {
    setRowSelection({});
  }, [filters, sorts, pagination.page]);

  // Realtime subscription
  useEffect(() => {
    if (!eventChannel || !eventTable) return;

    const channel = supabase
      .channel(eventChannel)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: eventTable },
        () => {
          // For realtime updates, fetch immediately without debouncing
          debouncedFetch(fetchParams);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventChannel, eventTable, supabase, debouncedFetch, fetchParams]);

  // Memoized table columns to prevent recreation on every render
  const tableColumns = useMemo((): ColumnDef<T>[] => {
    const cols: ColumnDef<T>[] = [];

    if (enableSelection) {
      cols.push({
        id: "select",
        header: ({ table }) => (
          <Checkbox
            checked={
              table.getIsAllPageRowsSelected() ||
              (table.getIsSomePageRowsSelected() && "indeterminate")
            }
            onCheckedChange={(value) =>
              table.toggleAllPageRowsSelected(!!value)
            }
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
      });
    }

    cols.push(
      ...columns
        .filter((col) => visibleColumns.has(col.key))
        .map(
          (col): ColumnDef<T> => ({
            id: col.key,
            accessorKey: col.key,
            header: col.label,
            cell: ({ row, getValue }) => {
              const value = getValue();
              return col.render
                ? col.render(value as string, row.original)
                : value;
            },
            enableSorting: col.sortable,
            size: col.width ? parseInt(col.width) : undefined,
          })
        )
    );

    if (actions.length > 0) {
      cols.push({
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {actions.map((action) => (
                <DropdownMenuItem
                  key={action.id}
                  onClick={() => action.onClick([row.original])}
                  disabled={action.disabled?.([row.original])}
                >
                  {action.icon && <span className="mr-2">{action.icon}</span>}
                  {action.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ),
        enableSorting: false,
        enableHiding: false,
      });
    }

    return cols;
  }, [columns, visibleColumns, enableSelection, actions]);

  // Memoized table instance
  const table = useReactTable({
    data,
    columns: tableColumns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
    enableRowSelection: enableSelection,
    onRowSelectionChange: setRowSelection,
    state: {
      pagination: {
        pageIndex: pagination.page - 1,
        pageSize: pagination.pageSize,
      },
      rowSelection,
    },
  });

  // Optimized filter management functions
  const addFilter = useCallback(
    (filter: DataTableFilter) => {
      setFilters((prev) => {
        const newFilters = [...prev, filter];
        setPagination((p) => ({ ...p, page: 1 }));
        updateUrlState({ filters: newFilters, page: 1 });
        return newFilters;
      });
    },
    [updateUrlState]
  );

  const removeFilter = useCallback(
    (index: number) => {
      setFilters((prev) => {
        const newFilters = prev.filter((_, i) => i !== index);
        setPagination((p) => ({ ...p, page: 1 }));
        updateUrlState({ filters: newFilters, page: 1 });
        return newFilters;
      });
    },
    [updateUrlState]
  );

  const clearFilters = useCallback(() => {
    setFilters([]);
    setPagination((prev) => ({ ...prev, page: 1 }));
    updateUrlState({ filters: [], page: 1 });
  }, [updateUrlState]);

  // View management
  const applyView = useCallback(
    (view: DataTableView) => {
      // Batch all state updates
      setFilters(view.filters);
      if (view.sorts) setSorts(view.sorts);
      if (view.columns) {
        setVisibleColumns(new Set(view.columns));
      }
      setActiveView(view.id);
      setPagination((prev) => ({ ...prev, page: 1 }));
      updateUrlState({
        filters: view.filters,
        sorts: view.sorts || [],
        page: 1,
        view: view.id,
      });
    },
    [updateUrlState]
  );

  // Sorting handlers
  const handleSort = useCallback(
    (columnKey: string) => {
      setSorts((prevSorts) => {
        const existingSort = prevSorts.find(
          (sort) => sort.column === columnKey
        );
        let newSorts: DataTableSort[];

        if (!existingSort) {
          newSorts = [...prevSorts, { column: columnKey, direction: "asc" }];
        } else if (existingSort.direction === "asc") {
          newSorts = prevSorts.map((sort) =>
            sort.column === columnKey
              ? { ...sort, direction: "desc" as const }
              : sort
          );
        } else {
          newSorts = prevSorts.filter((sort) => sort.column !== columnKey);
        }

        setPagination((prev) => ({ ...prev, page: 1 }));
        updateUrlState({ sorts: newSorts, page: 1 });
        return newSorts;
      });
    },
    [updateUrlState]
  );

  // Export functionality
  const exportData = useCallback(
    async (format: "csv" | "tsv") => {
      const separator = format === "csv" ? "," : "\t";
      const headers = columns
        .filter((col) => visibleColumns.has(col.key))
        .map((col) => col.label)
        .join(separator);

      const rows = data.map((row) =>
        columns
          .filter((col) => visibleColumns.has(col.key))
          .map((col) => {
            const value = row[col.key];
            const exportValue = col.exportTransform
              ? col.exportTransform(value, row)
              : value;

            return typeof exportValue === "string" &&
              exportValue.includes(separator)
              ? `"${exportValue.replace(/"/g, '""')}"`
              : exportValue;
          })
          .join(separator)
      );

      const content = [headers, ...rows].join("\n");
      const blob = new Blob([content], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `export.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    },
    [columns, visibleColumns, data]
  );

  // Pagination handlers
  const goToPage = useCallback(
    (page: number) => {
      setPagination((prev) => ({ ...prev, page }));
      updateUrlState({ page });
    },
    [updateUrlState]
  );

  const changePageSize = useCallback(
    (pageSize: number) => {
      setPagination((prev) => ({ ...prev, pageSize, page: 1 }));
      updateUrlState({ pageSize, page: 1 });
    },
    [updateUrlState]
  );

  const totalPages = Math.ceil(pagination.total / pagination.pageSize);

  // Manual refresh function
  const handleRefresh = useCallback(() => {
    // Force a refresh by clearing the last fetch key
    lastFetchParamsRef.current = "";
    debouncedFetch(fetchParams);
  }, [debouncedFetch, fetchParams]);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {views.length > 0 && (
            <Select
              value={activeView || ""}
              onValueChange={(value) => {
                const view = views.find((v) => v.id === value);
                if (view) applyView(view);
              }}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Select view" />
              </SelectTrigger>
              <SelectContent>
                {views.map((view) => (
                  <SelectItem key={view.id} value={view.id}>
                    {view.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <DataTableFilters columns={columns} onAddFilter={addFilter} />

          {enableRefresh && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={loading}
            >
              <RefreshCw
                className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              />
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {enableSelection && selectedRows.length > 0 && actions.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  Actions ({selectedRows.length})
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {actions.map((action) => (
                  <DropdownMenuItem
                    key={action.id}
                    onClick={() => action.onClick(selectedRows)}
                    disabled={action.disabled?.(selectedRows)}
                  >
                    {action.icon && <span className="mr-2">{action.icon}</span>}
                    {action.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {enableExport && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => exportData("csv")}>
                  Export CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportData("tsv")}>
                  Export TSV
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {enableColumnToggle && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Eye className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {columns.map((column) => (
                  <DropdownMenuCheckboxItem
                    key={column.key}
                    checked={visibleColumns.has(column.key)}
                    onCheckedChange={(checked) => {
                      setVisibleColumns((prev) => {
                        const newVisible = new Set(prev);
                        if (checked) {
                          newVisible.add(column.key);
                        } else {
                          newVisible.delete(column.key);
                        }
                        return newVisible;
                      });
                    }}
                  >
                    {column.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Active Filters */}
      {filters.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium">Filters:</span>
          {filters.map((filter, index) => (
            <Button
              key={index}
              variant="secondary"
              className="gap-1 h-fit !px-2 !py-1"
              onClick={() => removeFilter(index)}
            >
              {filter.column} {filter.operator} {String(filter.value)}
              <X className="h-3 w-3 cursor-pointer" />
            </Button>
          ))}
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Clear all
          </Button>
        </div>
      )}

      {/* Table */}
      <div className="border rounded-md">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
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
              table.getRowModel().rows.map((row) => (
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
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
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
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Showing {(pagination.page - 1) * pagination.pageSize + 1} to{" "}
          {Math.min(pagination.page * pagination.pageSize, pagination.total)} of{" "}
          {pagination.total} results
          {selectedRows.length > 0 && (
            <span className="ml-2">({selectedRows.length} selected)</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Select
            value={pagination.pageSize.toString()}
            onValueChange={(value) => changePageSize(Number(value))}
          >
            <SelectTrigger className="w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[10, 20, 50, 100].map((size) => (
                <SelectItem key={size} value={size.toString()}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            onClick={() => goToPage(pagination.page - 1)}
            disabled={pagination.page === 1 || loading}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <span className="text-sm">
            Page {pagination.page} of {totalPages}
          </span>

          <Button
            variant="outline"
            size="sm"
            onClick={() => goToPage(pagination.page + 1)}
            disabled={pagination.page >= totalPages || loading}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
