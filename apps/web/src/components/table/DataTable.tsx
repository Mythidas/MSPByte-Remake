"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";
import { useDataTableURL } from "@/lib/hooks/useDataTableURL";
import { useGlobalCache } from "@/lib/stores/global-cache";
import { DataTableSearch } from "./DataTableSearch";
import { DataTableToolbar } from "./DataTableToolbar";
import { DataTableFiltersDisplay } from "./DataTableFiltersDisplay";
import { DataTableBody } from "./DataTableBody";
import { DataTableFooter } from "./DataTableFooter";
import {
  DataTableProps,
  DataTableFetchParams,
  DataTableFilter,
  DataTableSort,
} from "@/lib/types/datatable";
import { Spinner } from "@workspace/ui/components/Spinner";

export function DataTable<T>({ ...props }: DataTableProps<T>) {
  return (
    <Suspense fallback={<Spinner />}>{<DataTableInner {...props} />}</Suspense>
  );
}

export function DataTableInner<T>({
  // Core props
  columns,
  fetcher,

  // Initial state
  initialFilters = [],
  initialSort = [],
  initialPageSize = 25,

  // Configuration
  views = [],
  actions = [],
  cacheKey,

  // Event listening
  eventChannel,
  eventTable,

  // Features
  enableSearch = true,
  searchPlaceholder = "Search...",
  enableSelection = false,
  enableRefresh = true,
  enableExport = false,

  // Styling
  className,
  emptyMessage = "No data found",
  loadingComponent,
  bodyHeight,

  // Callbacks
  onRowClick,
  onSelectionChange,
}: DataTableProps<T>) {
  const cache = useGlobalCache();

  // Get cached state if available
  const cachedState = cacheKey ? cache.getTableState<T>(cacheKey) : undefined;

  // URL state management - initialize from cache if available
  const urlState = useDataTableURL({
    initialState: {
      filters: cachedState?.filters || initialFilters,
      sorts: cachedState?.sort ? [cachedState.sort] : initialSort,
      pagination: cachedState?.pagination
        ? {
            ...cachedState.pagination,
            total:
              cachedState.data.count || cachedState.pagination.pageSize || 0,
          }
        : { page: 0, pageSize: initialPageSize, total: 0 },
      search: cachedState?.search || "",
      view: cachedState?.view || null,
    },
  });

  // Local state - initialize from cache if available
  const [data, setData] = useState<T[]>(cachedState?.data.rows || []);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRows, setSelectedRows] = useState<T[]>([]);
  const [hiddenColumns, setHiddenColumns] = useState<string[]>([]);
  const lastFetchParamsRef = useRef<string>("");

  // Get current state
  const { filters, sorts, pagination, search, view } = urlState.state;

  // Find current view details
  const currentView = useMemo(() => {
    return view ? views.find((v) => v.id === view) : null;
  }, [view, views]);

  // Apply view filters and sorts
  const effectiveFilters = useMemo(() => {
    if (currentView) {
      return [...currentView.filters, ...filters];
    }
    return filters;
  }, [currentView, filters]);

  const effectiveSorts = useMemo(() => {
    if (currentView?.sorts && currentView.sorts.length > 0) {
      return [...currentView.sorts, ...sorts];
    }
    return sorts;
  }, [currentView, sorts]);

  // Get searchable columns
  const searchableColumns = useMemo(() => {
    return columns
      .filter((col) => col.searchable === true)
      .map((col) => String(col.key));
  }, [columns]);

  // Create fetch parameters
  const fetchParams = useMemo((): DataTableFetchParams => {
    const params: DataTableFetchParams = {
      page: pagination.page,
      size: pagination.pageSize,
    };

    // Add filters
    if (effectiveFilters.length > 0) {
      params.filters = {};
      effectiveFilters.forEach((filter) => {
        params.filters![filter.column] = {
          op: filter.operator,
          value: filter.value,
        };
      });
    }

    // Add global search
    if (search && searchableColumns.length > 0) {
      params.globalSearch = search;
      params.globalFields = searchableColumns;
    }

    // Add sorting
    if (effectiveSorts.length > 0) {
      params.sorting = {};
      effectiveSorts.forEach((sort) => {
        params.sorting![sort.column] = sort.direction;
      });
    }

    return params;
  }, [pagination, effectiveFilters, effectiveSorts, search, searchableColumns]);

  // Create normalized parameters for cache key comparison
  const normalizedFetchParams = useMemo(() => {
    return JSON.stringify({
      page: fetchParams.page,
      size: fetchParams.size,
      filters: effectiveFilters,
      search: search,
      view: view,
      sort: effectiveSorts[0] || null,
    });
  }, [fetchParams, effectiveFilters, search, view, effectiveSorts]);

  // Fetch data with caching support
  const fetchData = useCallback(
    async (params: DataTableFetchParams, forceRefresh = false) => {
      const paramsKey = normalizedFetchParams;

      // Prevent duplicate fetches with same parameters
      if (lastFetchParamsRef.current === paramsKey && !forceRefresh) {
        return;
      }

      // Check cache first if caching is enabled and not forcing refresh
      if (cacheKey && !forceRefresh) {
        const cached = cache.getTableState<T>(cacheKey);
        const cachedParamsKey = cached
          ? JSON.stringify({
              page: cached.pagination.page,
              size: cached.pagination.pageSize,
              filters: cached.filters,
              search: cached.search,
              view: cached.view,
              sort: cached.sort,
            })
          : null;

        // If cached data matches current params and isn't expired, use it
        if (
          cached &&
          cachedParamsKey === paramsKey &&
          !cache.isTableExpired(cacheKey)
        ) {
          setData(cached.data.rows);
          if (pagination.total !== cached.data.count) {
            urlState.setPagination({
              ...pagination,
              total: cached.data.count,
            });
          }
          lastFetchParamsRef.current = paramsKey;
          return;
        }
      }

      lastFetchParamsRef.current = paramsKey;
      setIsLoading(true);
      setError(null);

      try {
        const result = await fetcher(params);

        if (result.error) {
          setError(result.error);
          setData([]);
        } else {
          setData(result.data);

          // Update total count only if it's different to avoid infinite loops
          if (pagination.total !== result.count) {
            urlState.setPagination({
              ...pagination,
              total: result.count,
            });
          }

          // Save to cache if caching is enabled
          if (cacheKey) {
            cache.setTableState(
              cacheKey,
              {
                data: { rows: result.data, count: result.count },
                pagination: {
                  page: params.page || 0,
                  pageSize: params.size || 25,
                },
                search: search,
                filters: filters,
                view: view,
                sort: effectiveSorts[0] || null,
              },
              10 * 60 * 1000
            ); // 10 minute TTL
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch data");
        setData([]);
      } finally {
        setIsLoading(false);
      }
    },
    [
      fetcher,
      pagination,
      urlState,
      cacheKey,
      cache,
      search,
      filters,
      view,
      effectiveSorts,
      normalizedFetchParams,
    ]
  );

  // Initial data fetch and refetch on params change
  useEffect(() => {
    fetchData(fetchParams);
  }, [fetchData, fetchParams]);

  // Real-time updates (placeholder for Supabase integration)
  useEffect(() => {
    if (!eventChannel || !eventTable) return;

    // TODO: Implement Supabase real-time subscriptions
    // This would listen to changes and call fetchData() when needed

    return () => {
      // Cleanup subscription
    };
  }, [eventChannel, eventTable, fetchData]);

  // Handle view changes
  const handleViewChange = useCallback(
    (viewId: string | null) => {
      urlState.setView(viewId);
      // Clear selection when view changes
      setSelectedRows([]);
    },
    [urlState]
  );

  // Handle filter changes
  const handleFiltersChange = useCallback(
    (newFilters: DataTableFilter[]) => {
      urlState.setFilters(newFilters);
      setSelectedRows([]);
    },
    [urlState]
  );

  // Handle sort changes
  const handleSortChange = useCallback(
    (newSorts: DataTableSort[]) => {
      urlState.setSorts(newSorts);
    },
    [urlState]
  );

  // Handle selection changes
  const handleSelectionChange = useCallback(
    (newSelectedRows: T[]) => {
      setSelectedRows(newSelectedRows);
      onSelectionChange?.(newSelectedRows);
    },
    [onSelectionChange]
  );

  // Handle actions
  const handleActionClick = useCallback(
    async (actionId: string, rows: T[]) => {
      const action = actions.find((a) => a.id === actionId);
      if (action) {
        try {
          await action.onClick(rows);
          // Clear cache and refresh data after action
          if (cacheKey) {
            cache.clearTableCache(cacheKey);
          }
          fetchData(fetchParams, true);
        } catch (err) {
          console.error("Action failed:", err);
        }
      }
    },
    [actions, fetchData, fetchParams, cacheKey, cache]
  );

  // Handle column visibility
  const handleColumnVisibilityChange = useCallback(
    (columnKey: string, visible: boolean) => {
      setHiddenColumns((prev) => {
        if (visible) {
          return prev.filter((key) => key !== columnKey);
        } else {
          return [...prev, columnKey];
        }
      });
    },
    []
  );

  // Handle export
  const handleExport = useCallback(
    async (format: "csv" | "tsv" | "json") => {
      try {
        // Fetch all data for export (without pagination)
        const exportParams = {
          ...fetchParams,
          page: 0,
          size: pagination.total,
        };
        const result = await fetcher(exportParams);

        if (result.error) {
          console.error("Export failed:", result.error);
          return;
        }

        const visibleColumns = columns.filter(
          (col) => !hiddenColumns.includes(String(col.key))
        );

        let content: string;
        let mimeType: string;
        let filename: string;

        switch (format) {
          case "csv":
            content = exportToCSV(result.data, visibleColumns);
            mimeType = "text/csv";
            filename = "export.csv";
            break;
          case "tsv":
            content = exportToTSV(result.data, visibleColumns);
            mimeType = "text/tab-separated-values";
            filename = "export.tsv";
            break;
          case "json":
            content = JSON.stringify(result.data, null, 2);
            mimeType = "application/json";
            filename = "export.json";
            break;
          default:
            return;
        }

        // Download file
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);
      } catch (err) {
        console.error("Export failed:", err);
      }
    },
    [fetchParams, pagination.total, fetcher, columns, hiddenColumns]
  );

  // Clear active filters
  const handleClearAllFilters = useCallback(() => {
    urlState.setFilters([]);
    urlState.setSearch("");
    urlState.setView(null);
    setSelectedRows([]);
  }, [urlState]);

  return (
    <div
      className={cn("flex flex-col gap-4 size-full overflow-hidden", className)}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        {/* Search */}
        {enableSearch && (
          <DataTableSearch
            value={search}
            onChange={urlState.setSearch}
            placeholder={searchPlaceholder}
            className="max-w-sm"
          />
        )}

        {/* Toolbar */}
        <DataTableToolbar
          actions={actions}
          selectedRows={selectedRows}
          onActionClick={handleActionClick}
          views={views}
          currentView={view}
          onViewChange={handleViewChange}
          filters={filters}
          onFiltersChange={handleFiltersChange}
          columns={columns}
          hiddenColumns={hiddenColumns}
          onColumnVisibilityChange={handleColumnVisibilityChange}
          enableExport={enableExport}
          onExport={handleExport}
          enableRefresh={enableRefresh}
          onRefresh={() => {
            if (cacheKey) {
              cache.clearTableCache(cacheKey);
            }
            fetchData(fetchParams, true);
          }}
          isRefreshing={isLoading}
        />
      </div>

      {/* Active Filters Display */}
      <DataTableFiltersDisplay
        columns={columns}
        filters={filters}
        search={search}
        currentView={view}
        viewName={currentView?.name}
        onFilterRemove={(index) => {
          const newFilters = filters.filter((_, i) => i !== index);
          handleFiltersChange(newFilters);
        }}
        onSearchClear={() => urlState.setSearch("")}
        onViewClear={() => handleViewChange(null)}
        onClearAll={handleClearAllFilters}
      />

      {/* Error Display */}
      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Table Body */}
      <DataTableBody
        columns={columns}
        data={data}
        sorts={effectiveSorts}
        hiddenColumns={hiddenColumns}
        isLoading={isLoading}
        enableSelection={enableSelection}
        selectedRows={selectedRows}
        onSortChange={handleSortChange}
        onRowClick={onRowClick}
        onSelectionChange={handleSelectionChange}
        emptyMessage={emptyMessage}
        loadingComponent={loadingComponent}
        className={bodyHeight ? `h-[${bodyHeight}]` : "flex-1"}
      />

      {/* Footer */}
      <DataTableFooter
        pagination={pagination}
        onPaginationChange={urlState.setPagination}
        selectedCount={selectedRows.length}
      />
    </div>
  );
}

// Export utility functions
function exportToCSV<T>(data: T[], columns: any[]): string {
  const headers = columns.map((col) => col.label);
  const rows = data.map((row) =>
    columns.map((col) => {
      const value = row[col.key as keyof T];
      const stringValue = col.exportTransform
        ? col.exportTransform(String(value ?? ""), row)
        : String(value ?? "");
      // Escape commas and quotes
      return `"${stringValue.replace(/"/g, '""')}"`;
    })
  );

  return [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
}

function exportToTSV<T>(data: T[], columns: any[]): string {
  const headers = columns.map((col) => col.label);
  const rows = data.map((row) =>
    columns.map((col) => {
      const value = row[col.key as keyof T];
      const stringValue = col.exportTransform
        ? col.exportTransform(String(value ?? ""), row)
        : String(value ?? "");
      // Escape tabs
      return stringValue.replace(/\t/g, " ");
    })
  );

  return [headers.join("\t"), ...rows.map((row) => row.join("\t"))].join("\n");
}
