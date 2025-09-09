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
import { MoreHorizontal } from "lucide-react";
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
} from "@/components/ui/dropdown-menu";
import { createClient } from "@/lib/supabase/client";
import {
  ColumnDef,
  useReactTable,
  getCoreRowModel,
  RowSelectionState,
} from "@tanstack/react-table";
import { Checkbox } from "@/components/ui/checkbox";
import DataTableToolbar from "@/components/DataTable/DataTableToolbar";
import DataTableSearch from "@/components/DataTable/DataTableSearch";
import DataTableActiveFilters from "@/components/DataTable/DataTableActiveFilters";
import DataTableBody from "@/components/DataTable/DataTableBody";
import DataTableFooter from "@/components/DataTable/DataTableFooter";
import useDataTableUrlState from "@/lib/hooks/useDataTableUrlState";
import { Filters } from "@workspace/shared/types/database";

// Helper function to safely get nested property values
function getNestedValue(obj: any, path: string): any {
  if (!path || !obj) return obj;
  const keys = path.split(/[\.\[\]]/).filter(Boolean);
  let current = obj;
  for (const key of keys) {
    if (current == null) return undefined;
    current = current[key];
  }
  return current;
}

// Helper function to convert value to searchable string
function valueToSearchString(value: any): string {
  if (value == null) return "";
  if (typeof value === "string") return value.toLowerCase();
  if (typeof value === "number") return value.toString();
  if (typeof value === "boolean") return value.toString();
  if (Array.isArray(value)) return value.join(" ").toLowerCase();
  if (typeof value === "object") {
    return Object.values(value)
      .filter((v) => typeof v === "string" || typeof v === "number")
      .join(" ")
      .toLowerCase();
  }
  return String(value).toLowerCase();
}

// DataTable Fallback Component
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

// Main DataTable Component
export function DataTable<T extends Record<string, any>>(
  props: DataTableProps<T>
) {
  return (
    <Suspense fallback={<DataTableFallback />}>
      <DataTableContent {...props} />
    </Suspense>
  );
}

// Core DataTable Logic Component
function DataTableContent<T extends Record<string, any>>(
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
    enableSearch = true,
    searchPlaceholder = "Search...",
    searchableColumns,
    className,
    emptyMessage = "No data found",
    loadingComponent,
    bodyHeight,
    onRowClick,
    onSelectionChange,
  } = props;

  const supabase = createClient();

  // URL state management
  const {
    isInitialized,
    pagination,
    setPagination,
    filters,
    setFilters,
    sorts,
    setSorts,
    searchTerm,
    setSearchTerm,
    activeView,
    setActiveView,
    updateUrlState,
  } = useDataTableUrlState(
    useUrlState,
    urlStateKey,
    initialFilters,
    initialSort,
    initialPageSize
  );

  // Data and UI state
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(
    new Set(columns.map((col) => col.key as string))
  );

  // Local search state to handle immediate UI updates
  const [localSearchTerm, setLocalSearchTerm] = useState(searchTerm || "");

  // Refs for preventing unnecessary re-renders and duplicate fetches
  const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastFetchParamsRef = useRef<string>("");
  const isFetchingRef = useRef(false);

  // Sync local search state with URL state when URL state changes
  useEffect(() => {
    setLocalSearchTerm(searchTerm || "");
  }, [searchTerm]);

  // Determine which columns are searchable
  const searchColumns = useMemo(() => {
    if (searchableColumns) {
      return columns.filter((col) => searchableColumns.includes(col.key));
    }
    return columns.filter(
      (col) =>
        !col.searchable === false && col.key !== "id" && col.key !== "actions"
    );
  }, [columns, searchableColumns]);

  // Stable fetch parameters - key optimization #1
  const fetchParams = useMemo(
    () => ({
      page: pagination.page,
      pageSize: pagination.pageSize,
      filters,
      sorts,
      search: searchTerm,
    }),
    [pagination.page, pagination.pageSize, filters, sorts, searchTerm]
  );

  // Improved debounced fetch function with duplicate prevention
  const debouncedFetch = useCallback(
    async (params: typeof fetchParams) => {
      const fetchKey = JSON.stringify(params);

      // Prevent duplicate fetches - key optimization #3
      if (fetchKey === lastFetchParamsRef.current || isFetchingRef.current) {
        return;
      }

      lastFetchParamsRef.current = fetchKey;
      isFetchingRef.current = true;

      // Clear any pending fetch
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }

      // Only show loading for filter/sort/search changes, not pagination
      const isPageChangeOnly =
        data.length > 0 &&
        lastFetchParamsRef.current &&
        JSON.stringify({ ...params, page: 1 }) ===
          JSON.stringify({
            ...JSON.parse(lastFetchParamsRef.current),
            page: 1,
          });

      if (!isPageChangeOnly) {
        setLoading(true);
      }
      setError(null);

      try {
        const result = await fetcher({
          filters: Object.fromEntries(
            params.filters.map((filter) => [
              filter.column,
              { op: filter.operator, value: filter.value },
            ])
          ) as Filters,
          sorting: Object.fromEntries(
            params.sorts.map((sort) => [sort.column, sort.direction])
          ),
          page: params.page,
          size: params.pageSize,
          globalFields: columns
            .filter((col) => col.searchable)
            .map((col) => col.key as string),
          globalSearch: searchTerm,
        });

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
        isFetchingRef.current = false;
      }
    },
    [fetcher, setPagination, data.length, columns, searchTerm]
  );

  // Only fetch after initialization is complete - key optimization #3
  useEffect(() => {
    if (!isInitialized) return;

    // Clear any pending timeout
    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current);
    }

    // Debounce subsequent updates
    fetchTimeoutRef.current = setTimeout(() => {
      debouncedFetch(fetchParams);
    }, 150);

    return () => {
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
    };
  }, [isInitialized, fetchParams, debouncedFetch]);

  // Get selected rows
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

  // Reset row selection when data changes
  useEffect(() => {
    setRowSelection({});
  }, [filters, sorts, pagination.page, searchTerm]);

  // Handle search changes with URL state - FIXED VERSION
  const handleSearchChange = useCallback(
    (term: string) => {
      // Update local state immediately for responsive UI
      setLocalSearchTerm(term);

      // Clear existing timeout
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }

      // Debounce the actual search and URL update
      searchTimeoutRef.current = setTimeout(() => {
        setSearchTerm(term);
        setPagination((prev) => ({ ...prev, page: 1 }));
        updateUrlState({ search: term, page: 1 });
      }, 300); // 300ms debounce for search
    },
    [setSearchTerm, setPagination, updateUrlState]
  );

  // Realtime subscription
  useEffect(() => {
    if (!eventChannel || !eventTable || !isInitialized) return;

    const channel = supabase
      .channel(eventChannel)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: eventTable },
        () => {
          // Force refresh by clearing the last fetch key
          lastFetchParamsRef.current = "";
          debouncedFetch(fetchParams);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [
    eventChannel,
    eventTable,
    supabase,
    debouncedFetch,
    fetchParams,
    isInitialized,
  ]);

  // Memoized table columns
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
        .filter((col) => visibleColumns.has(col.key as string))
        .map(
          (col): ColumnDef<T> => ({
            id: col.key as string,
            accessorFn: (row) => getNestedValue(row, col.key as string),
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

  // Table instance
  const table = useReactTable({
    data: data,
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

  // Filter management functions
  const addFilter = useCallback(
    (filter: DataTableFilter) => {
      setFilters((prev) => {
        const newFilters = [...prev, filter];
        setPagination((p) => ({ ...p, page: 1 }));
        updateUrlState({ filters: newFilters, page: 1 });
        return newFilters;
      });
    },
    [setFilters, updateUrlState, setPagination]
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
    [setFilters, updateUrlState, setPagination]
  );

  const clearFilters = useCallback(() => {
    setFilters([]);
    setPagination((prev) => ({ ...prev, page: 1 }));
    updateUrlState({ filters: [], page: 1 });
  }, [setFilters, updateUrlState, setPagination]);

  // View management
  const applyView = useCallback(
    (view: DataTableView) => {
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
    [setFilters, setSorts, setActiveView, setPagination, updateUrlState]
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
    [setSorts, updateUrlState, setPagination]
  );

  // Export functionality
  const exportData = useCallback(
    async (format: "csv" | "tsv") => {
      const separator = format === "csv" ? "," : "\t";
      const headers = columns
        .filter((col) => visibleColumns.has(col.key as string))
        .map((col) => col.label)
        .join(separator);

      const exportRows = data.map((row) =>
        columns
          .filter((col) => visibleColumns.has(col.key as string))
          .map((col) => {
            const value = getNestedValue(row, col.key as string);
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

      const content = [headers, ...exportRows].join("\n");
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
    [setPagination, updateUrlState]
  );

  const changePageSize = useCallback(
    (pageSize: number) => {
      setPagination((prev) => ({ ...prev, pageSize, page: 1 }));
      updateUrlState({ pageSize, page: 1 });
    },
    [setPagination, updateUrlState]
  );

  // Manual refresh function
  const handleRefresh = useCallback(() => {
    lastFetchParamsRef.current = "";
    debouncedFetch(fetchParams);
  }, [debouncedFetch, fetchParams]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className={`flex flex-col size-full space-y-4 ${className}`}>
      {/* Toolbar */}
      <DataTableToolbar
        views={views}
        activeView={activeView}
        applyView={applyView}
        columns={columns}
        addFilter={addFilter}
        enableRefresh={enableRefresh}
        loading={loading}
        handleRefresh={handleRefresh}
        enableSelection={enableSelection}
        selectedRows={selectedRows}
        actions={actions}
        enableExport={enableExport}
        exportData={exportData}
        enableColumnToggle={enableColumnToggle}
        visibleColumns={visibleColumns}
        setVisibleColumns={setVisibleColumns}
      />

      {/* Search */}
      <DataTableSearch
        enableSearch={enableSearch}
        searchPlaceholder={searchPlaceholder}
        searchTerm={localSearchTerm} // Use local search term for immediate UI response
        handleSearchChange={handleSearchChange}
      />

      {/* Active Filters */}
      <DataTableActiveFilters
        filters={filters}
        searchTerm={searchTerm} // Use actual search term for filter display
        removeFilter={removeFilter}
        clearFilters={clearFilters}
        handleSearchChange={handleSearchChange}
      />

      {/* Table Body */}
      <DataTableBody
        table={table}
        loading={loading}
        error={error}
        tableColumns={tableColumns}
        loadingComponent={loadingComponent}
        emptyMessage={emptyMessage}
        onRowClick={onRowClick}
        columns={columns}
        sorts={sorts}
        handleSort={handleSort}
        height={bodyHeight}
      />

      {/* Footer */}
      <DataTableFooter
        pagination={pagination}
        selectedRows={selectedRows}
        searchTerm={searchTerm}
        changePageSize={changePageSize}
        goToPage={goToPage}
        loading={loading}
      />
    </div>
  );
}
