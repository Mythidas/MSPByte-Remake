import {
  DataTableFilter,
  DataTableSort,
  DataTablePagination,
} from "@/lib/types/datatable";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, useCallback } from "react";

export default function useDataTableUrlState(
  useUrlState: boolean,
  urlStateKey: string,
  initialFilters: DataTableFilter[],
  initialSort: DataTableSort[],
  initialPageSize: number
) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isInitialized, setIsInitialized] = useState(false);

  // State
  const [pagination, setPagination] = useState<DataTablePagination>({
    page: 1,
    pageSize: initialPageSize,
    total: 0,
  });
  const [filters, setFilters] = useState<DataTableFilter[]>(initialFilters);
  const [sorts, setSorts] = useState<DataTableSort[]>(initialSort);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeView, setActiveView] = useState<string | null>(null);

  // Initialize from URL state only once
  useEffect(() => {
    if (!useUrlState || isInitialized) return;

    const params = new URLSearchParams(searchParams.toString());
    const stateParam = params.get(urlStateKey);

    if (stateParam) {
      try {
        const state = JSON.parse(decodeURIComponent(stateParam));

        // Apply all state updates synchronously
        if (state.page || state.pageSize) {
          setPagination({
            page: state.page || 1,
            pageSize: state.pageSize || initialPageSize,
            total: 0,
          });
        }
        if (state.filters) setFilters(state.filters);
        if (state.sorts) setSorts(state.sorts);
        if (state.search) setSearchTerm(state.search);
        if (state.view) setActiveView(state.view);
      } catch (e) {
        console.warn("Failed to parse URL state:", e);
      }
    }

    setIsInitialized(true);
  }, [useUrlState, urlStateKey, searchParams, initialPageSize, isInitialized]);

  // URL state update function with debouncing
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
      if (!useUrlState || !isInitialized) return;

      // Debounce URL updates
      const timeoutId = setTimeout(() => {
        const params = new URLSearchParams(searchParams.toString());
        const currentStateParam = params.get(urlStateKey);
        const currentState = currentStateParam
          ? JSON.parse(decodeURIComponent(currentStateParam))
          : {};

        const updatedState = { ...currentState, ...newState };

        // Only update if state actually changed
        if (JSON.stringify(currentState) !== JSON.stringify(updatedState)) {
          params.set(
            urlStateKey,
            encodeURIComponent(JSON.stringify(updatedState))
          );
          router.push(`?${params.toString()}`, { scroll: false });
        }
      }, 100);

      return () => clearTimeout(timeoutId);
    },
    [useUrlState, isInitialized, searchParams, urlStateKey, router]
  );

  return {
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
  };
}
