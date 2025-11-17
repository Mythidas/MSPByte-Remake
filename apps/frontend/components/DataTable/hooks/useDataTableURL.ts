"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useCallback, useMemo } from "react";
import { deserializeFilters, serializeFilters } from "../utils/filters";
import { URLState, TableFilter } from "../types";

/**
 * Hook to manage DataTable state in URL search params
 * Provides bidirectional sync between URL and component state
 */
export function useDataTableURL() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();

    // Parse current URL state
    const urlState: URLState = useMemo(() => ({
        page: parseInt(searchParams.get("page") || "1", 10),
        pageSize: parseInt(searchParams.get("size") || "50", 10),
        globalSearch: searchParams.get("search") || "",
        sortBy: searchParams.get("sort") || "",
        filters: deserializeFilters(searchParams.get("filters") || ""),
        view: searchParams.get("view") || "",
    }), [searchParams]);

    // Update URL with new state
    const updateURL = useCallback((updates: Partial<URLState>) => {
        // Always read fresh search params to avoid stale closures
        const currentParams = new URLSearchParams(window.location.search);

        // Track if we need to reset pagination
        let shouldResetPage = false;

        // Update global search
        if (updates.globalSearch !== undefined) {
            const currentSearch = currentParams.get("search") || "";
            if (currentSearch !== updates.globalSearch) {
                shouldResetPage = true;
                if (!updates.globalSearch) currentParams.delete("search");
                else currentParams.set("search", updates.globalSearch);
            }
        }

        // Update filters
        if (updates.filters !== undefined) {
            const currentFilters = currentParams.get("filters") || "";
            const newFilters = serializeFilters(updates.filters);
            if (currentFilters !== newFilters) {
                shouldResetPage = true;
                if (!newFilters) currentParams.delete("filters");
                else currentParams.set("filters", newFilters);
            }
        }

        // Update view
        if (updates.view !== undefined) {
            const currentView = currentParams.get("view") || "";
            if (currentView !== updates.view) {
                shouldResetPage = true;
                if (!updates.view) currentParams.delete("view");
                else currentParams.set("view", updates.view);
            }
        }

        // Update sort
        if (updates.sortBy !== undefined) {
            if (!updates.sortBy) currentParams.delete("sort");
            else currentParams.set("sort", updates.sortBy);
        }

        // Update page size
        if (updates.pageSize !== undefined) {
            if (updates.pageSize === 50) currentParams.delete("size");
            else currentParams.set("size", String(updates.pageSize));
        }

        // Update page (or reset if filters/search/view changed)
        if (shouldResetPage) {
            currentParams.delete("page");
        } else if (updates.page !== undefined) {
            if (updates.page === 1) currentParams.delete("page");
            else currentParams.set("page", String(updates.page));
        }

        // Update URL
        const queryString = currentParams.toString();
        const newUrl = `${pathname}${queryString ? `?${queryString}` : ""}`;
        router.push(newUrl, { scroll: false });
    }, [router, pathname]);

    return { urlState, updateURL };
}
