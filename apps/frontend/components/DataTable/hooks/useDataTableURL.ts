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
        const params = new URLSearchParams(searchParams.toString());

        // Update or remove parameters
        if (updates.page !== undefined) {
            if (updates.page === 1) params.delete("page");
            else params.set("page", String(updates.page));
        }

        if (updates.pageSize !== undefined) {
            if (updates.pageSize === 50) params.delete("size");
            else params.set("size", String(updates.pageSize));
        }

        if (updates.globalSearch !== undefined) {
            if (!updates.globalSearch) params.delete("search");
            else params.set("search", updates.globalSearch);
            // Reset to page 1 on search
            params.delete("page");
        }

        if (updates.sortBy !== undefined) {
            if (!updates.sortBy) params.delete("sort");
            else params.set("sort", updates.sortBy);
        }

        if (updates.filters !== undefined) {
            const serialized = serializeFilters(updates.filters);
            if (!serialized) params.delete("filters");
            else params.set("filters", serialized);
            // Reset to page 1 on filter change
            params.delete("page");
        }

        if (updates.view !== undefined) {
            if (!updates.view) params.delete("view");
            else params.set("view", updates.view);
            // Reset to page 1 on view change
            params.delete("page");
        }

        // Update URL
        const queryString = params.toString();
        router.push(`${pathname}${queryString ? `?${queryString}` : ""}`, { scroll: false });
    }, [searchParams, router, pathname]);

    return { urlState, updateURL };
}
