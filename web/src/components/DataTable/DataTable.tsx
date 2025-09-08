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

// Helper function to safely get nested property values
function getNestedValue(obj: any, path: string): any {
  if (!path || !obj) return obj;

  // Handle array notation and dot notation
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
    // For objects, search through all string values
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
      <DataTableUrlProvider {...props} />
    </Suspense>
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
    enableSearch = true,
    searchPlaceholder = "Search...",
    searchableColumns,
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
  const [searchTerm, setSearchTerm] = useState("");
  const [pagination, setPagination] = useState<DataTablePagination>({
    page: 1,
    pageSize: initialPageSize,
    total: 0,
  });
  const [filters, setFilters] = useState<DataTableFilter[]>(initialFilters);
  const [sorts, setSorts] = useState<DataTableSort[]>(initialSort);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(
    new Set(columns.map((col) => col.key as string))
  );
  const [activeView, setActiveView] = useState<string | null>(null);
  const [pendingUrlState, setPendingUrlState] = useState<object | null>(null);

  // Determine which columns are searchable
  const searchColumns = useMemo(() => {
    if (searchableColumns) {
      return columns.filter((col) => searchableColumns.includes(col.key));
    }
    // Default to text-based columns if not specified
    return columns.filter(
      (col) =>
        !col.searchable === false && // Allow explicit opt-out
        col.key !== "id" && // Usually not useful to search IDs
        col.key !== "actions" // Don't search action columns
    );
  }, [columns, searchableColumns]);

  // Filter data based on search term (client-side for now)
  const searchFilteredData = useMemo(() => {
    if (!searchTerm.trim() || !enableSearch) return data;

    const lowerSearchTerm = searchTerm.toLowerCase();

    return data.filter((row) => {
      return searchColumns.some((column) => {
        const value = getNestedValue(row, column.key as string);
        const searchString = valueToSearchString(value);
        return searchString.includes(lowerSearchTerm);
      });
    });
  }, [data, searchTerm, searchColumns, enableSearch]);

  // Get selected rows based on current row selection state
  const selectedRows = useMemo(() => {
    return Object.keys(rowSelection)
      .filter((index) => rowSelection[index])
      .map((index) => searchFilteredData[parseInt(index)])
      .filter((i) => !!i);
  }, [rowSelection, searchFilteredData]);

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
        search: string;
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

    // Clear after applying so it doesn't loop
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
        if (state.search) updates.searchTerm = state.search;
        if (state.view) updates.activeView = state.view;

        // Apply all updates at once
        if (updates.pagination) setPagination(updates.pagination);
        if (updates.filters) setFilters(updates.filters);
        if (updates.sorts) setSorts(updates.sorts);
        if (updates.searchTerm) setSearchTerm(updates.searchTerm);
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
      search?: string;
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
      const isNewSearch = params.search !== searchTerm;

      if (isInitialLoadRef.current || isNewFilter || isNewSort || isNewSearch) {
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
    [fetcher, filters, sorts, searchTerm]
  );

  // Memoized fetch parameters to prevent unnecessary re-renders
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
  }, [filters, sorts, pagination.page, searchTerm]);

  // Handle search changes with URL state
  const handleSearchChange = useCallback(
    (term: string) => {
      setSearchTerm(term);
      setPagination((prev) => ({ ...prev, page: 1 }));
      updateUrlState({ search: term, page: 1 });
    },
    [updateUrlState]
  );

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

  // Memoized table instance
  const table = useReactTable({
    data: searchFilteredData,
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
        .filter((col) => visibleColumns.has(col.key as string))
        .map((col) => col.label)
        .join(separator);

      const exportRows = searchFilteredData.map((row) =>
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
    [columns, visibleColumns, searchFilteredData]
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

  // Manual refresh function
  const handleRefresh = useCallback(() => {
    // Force a refresh by clearing the last fetch key
    lastFetchParamsRef.current = "";
    debouncedFetch(fetchParams);
  }, [debouncedFetch, fetchParams]);

  return (
    <div className={`space-y-4 ${className}`}>
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
        searchTerm={searchTerm}
        handleSearchChange={handleSearchChange}
      />

      {/* Active Filters */}
      <DataTableActiveFilters
        filters={filters}
        searchTerm={searchTerm}
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
