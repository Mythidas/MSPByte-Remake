"use client";

import { useState, useCallback, useMemo } from "react";
import { TableFilter, TableView } from "../types";

interface UseDataTableFiltersProps {
  views?: TableView[];
  initialFilters?: TableFilter[];
}

/**
 * Hook to manage table filters and views
 */
export function useDataTableFilters({
  views = [],
  initialFilters = [],
}: UseDataTableFiltersProps = {}) {
  const [filters, setFilters] = useState<TableFilter[]>(initialFilters);
  const [activeView, setActiveView] = useState<TableView | undefined>(
    views.find((v) => v.isDefault),
  );

  // Add a new filter
  const addFilter = useCallback((filter: TableFilter) => {
    setFilters((prev) => [...prev, filter]);
  }, []);

  // Remove a filter by matching object
  const removeFilter = useCallback((filterToRemove: TableFilter) => {
    setFilters((prev) =>
      prev.filter(
        (f) =>
          !(
            f.field === filterToRemove.field &&
            f.operator === filterToRemove.operator &&
            JSON.stringify(f.value) === JSON.stringify(filterToRemove.value)
          ),
      ),
    );
  }, []);

  // Clear all dynamic filters (keeps view filters)
  const clearFilters = useCallback(() => {
    setFilters([]);
  }, []);

  // Clear everything including view
  const clearAll = useCallback(() => {
    setFilters([]);
    setActiveView(undefined);
  }, []);

  // Apply a view by id
  const applyView = useCallback(
    (viewId: string | undefined) => {
      if (!viewId) {
        setActiveView(undefined);
        return;
      }
      const view = views.find((v) => v.id === viewId);
      setActiveView(view);
    },
    [views],
  );

  // Combined filters (view + dynamic)
  const combinedFilters = useMemo(() => {
    const viewFilters = activeView?.filters || [];
    return [...viewFilters, ...filters];
  }, [activeView, filters]);

  return {
    filters,
    setFilters,
    activeView,
    setActiveView,
    combinedFilters,
    addFilter,
    removeFilter,
    clearFilters,
    clearAll,
    applyView,
  };
}
