"use client";

import { useCallback, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DataTableFilter, DataTableSort, DataTablePagination } from "../types/datatable";

export interface DataTableURLState {
  filters: DataTableFilter[];
  sorts: DataTableSort[];
  pagination: DataTablePagination;
  search: string;
  view: string | null;
}

export interface UseDataTableURLOptions {
  enabled?: boolean;
  key?: string;
  initialState?: Partial<DataTableURLState>;
}

export function useDataTableURL(options: UseDataTableURLOptions = {}) {
  const { enabled = true, key = "table", initialState = {} } = options;
  const router = useRouter();
  const searchParams = useSearchParams();

  const [state, setState] = useState<DataTableURLState>(() => {
    if (!enabled) {
      return {
        filters: initialState.filters || [],
        sorts: initialState.sorts || [],
        pagination: initialState.pagination || { page: 0, pageSize: 25, total: 0 },
        search: initialState.search || "",
        view: initialState.view || null,
      };
    }

    // Parse URL state
    const filters = parseFiltersFromURL(searchParams.get(`${key}_filters`));
    const sorts = parseSortsFromURL(searchParams.get(`${key}_sort`));
    const page = parseInt(searchParams.get(`${key}_page`) || "0");
    const pageSize = parseInt(searchParams.get(`${key}_size`) || "25");
    const search = searchParams.get(`${key}_search`) || "";
    const view = searchParams.get(`${key}_view`);

    return {
      filters: filters.length > 0 ? filters : (initialState.filters || []),
      sorts: sorts.length > 0 ? sorts : (initialState.sorts || []),
      pagination: { page, pageSize, total: 0 },
      search: search || (initialState.search || ""),
      view: view || initialState.view || null,
    };
  });

  const updateURL = useCallback((newState: DataTableURLState) => {
    if (!enabled) return;

    const params = new URLSearchParams(searchParams.toString());

    // Update filters
    if (newState.filters.length > 0) {
      params.set(`${key}_filters`, serializeFilters(newState.filters));
    } else {
      params.delete(`${key}_filters`);
    }

    // Update sorts
    if (newState.sorts.length > 0) {
      params.set(`${key}_sort`, serializeSorts(newState.sorts));
    } else {
      params.delete(`${key}_sort`);
    }

    // Update pagination
    if (newState.pagination.page > 0) {
      params.set(`${key}_page`, newState.pagination.page.toString());
    } else {
      params.delete(`${key}_page`);
    }

    if (newState.pagination.pageSize !== 25) {
      params.set(`${key}_size`, newState.pagination.pageSize.toString());
    } else {
      params.delete(`${key}_size`);
    }

    // Update search
    if (newState.search) {
      params.set(`${key}_search`, newState.search);
    } else {
      params.delete(`${key}_search`);
    }

    // Update view
    if (newState.view) {
      params.set(`${key}_view`, newState.view);
    } else {
      params.delete(`${key}_view`);
    }

    router.push(`?${params.toString()}`, { scroll: false });
  }, [enabled, key, router, searchParams]);

  const updateState = useCallback((updates: Partial<DataTableURLState>) => {
    setState(prevState => {
      const newState = { ...prevState, ...updates };
      // Use setTimeout to avoid updating URL during render
      setTimeout(() => updateURL(newState), 0);
      return newState;
    });
  }, [updateURL]);

  const setFilters = useCallback((filters: DataTableFilter[]) => {
    updateState({ filters, pagination: { ...state.pagination, page: 0 } });
  }, [updateState, state.pagination]);

  const setSorts = useCallback((sorts: DataTableSort[]) => {
    updateState({ sorts, pagination: { ...state.pagination, page: 0 } });
  }, [updateState, state.pagination]);

  const setPagination = useCallback((pagination: DataTablePagination) => {
    updateState({ pagination });
  }, [updateState]);

  const setSearch = useCallback((search: string) => {
    updateState({ search, pagination: { ...state.pagination, page: 0 } });
  }, [updateState, state.pagination]);

  const setView = useCallback((view: string | null) => {
    updateState({ view, pagination: { ...state.pagination, page: 0 } });
  }, [updateState, state.pagination]);

  const resetFilters = useCallback(() => {
    setFilters([]);
  }, [setFilters]);

  const resetAll = useCallback(() => {
    updateState({
      filters: [],
      sorts: [],
      pagination: { page: 0, pageSize: 25, total: 0 },
      search: "",
      view: null,
    });
  }, [updateState]);

  return {
    state,
    setFilters,
    setSorts,
    setPagination,
    setSearch,
    setView,
    resetFilters,
    resetAll,
    updateState,
  };
}

// Helper functions for URL serialization
function serializeFilters(filters: DataTableFilter[]): string {
  return filters
    .map(f => `${f.column}_${f.operator}_${encodeURIComponent(f.value)}`)
    .join(",");
}

function parseSortsFromURL(sortString: string | null): DataTableSort[] {
  if (!sortString) return [];

  return sortString.split(",").map(sort => {
    const parts = sort.split("_");
    if (parts.length >= 2) {
      const direction = parts[parts.length - 1] as "asc" | "desc";
      const column = parts.slice(0, -1).join("_");
      return { column, direction };
    }
    return { column: sort, direction: "asc" as const };
  }).filter(Boolean);
}

function serializeSorts(sorts: DataTableSort[]): string {
  return sorts
    .map(s => `${s.column}_${s.direction}`)
    .join(",");
}

function parseFiltersFromURL(filtersString: string | null): DataTableFilter[] {
  if (!filtersString) return [];

  return filtersString.split(",").map(filter => {
    const parts = filter.split("_");
    if (parts.length >= 3) {
      const operator = parts[1];
      const column = parts[0];
      const value = decodeURIComponent(parts.slice(2).join("_"));

      return {
        column,
        operator: operator as DataTableFilter["operator"],
        value,
      };
    }
    return null;
  }).filter(Boolean) as DataTableFilter[];
}