import { DataTableFilter } from "@/lib/types/datatable";
import { useState, useCallback } from "react";

export function useDataTableFilters(initialFilters: DataTableFilter[] = []) {
  const [filters, setFilters] = useState<DataTableFilter[]>(initialFilters);

  const addFilter = useCallback((filter: DataTableFilter) => {
    setFilters((prev) => [...prev, filter]);
  }, []);

  const removeFilter = useCallback((index: number) => {
    setFilters((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const updateFilter = useCallback((index: number, filter: DataTableFilter) => {
    setFilters((prev) => prev.map((f, i) => (i === index ? filter : f)));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters([]);
  }, []);

  const hasFilters = filters.length > 0;

  return {
    filters,
    addFilter,
    removeFilter,
    updateFilter,
    clearFilters,
    hasFilters,
    setFilters,
  };
}
