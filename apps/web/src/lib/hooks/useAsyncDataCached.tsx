"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  useGlobalCache,
  generateCacheKey,
  getFunctionHash,
} from "@/lib/stores/global-cache";

// Extended options for cached async data
export interface UseAsyncDataCachedOptions<T, R = T> {
  // Dependencies array - refetch when these change
  deps?: any[];
  // Transform function to process data before returning
  transform?: (data: T) => R;
  // Refetch interval in milliseconds
  refetchInterval?: number;
  // Initial data
  initialData?: R | null;
  // Whether to fetch immediately on mount
  immediate?: boolean;
  // Whether to abort request on unmount (default: true)
  abortOnUnmount?: boolean;

  // Caching options
  cacheKey?: string; // Custom cache key
  namespace?: string; // Cache namespace for organization
  ttl?: number; // Time to live in milliseconds
  enableCache?: boolean; // Enable/disable caching (default: true)
  staleWhileRevalidate?: boolean; // Return stale data while fetching new (default: true)
}

export interface AsyncStateCached<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  clearCache: () => void;
  isFromCache: boolean;
}

/**
 * Enhanced useAsyncData with global caching support
 * Automatically prevents mount/unmount issues by persisting data in global store
 */
export function useAsyncDataCached<T, R = T>(
  fetchFn: (signal?: AbortSignal) => Promise<T>,
  options: UseAsyncDataCachedOptions<T, R> = {}
): AsyncStateCached<R> {
  const {
    deps = [],
    transform,
    refetchInterval,
    initialData = null,
    immediate = true,
    abortOnUnmount = true,
    cacheKey: customCacheKey,
    namespace = "global",
    ttl,
    enableCache = true,
    staleWhileRevalidate = true,
  } = options;

  const cache = useGlobalCache();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Generate cache key
  const functionHash = getFunctionHash(fetchFn);
  const cacheKey =
    customCacheKey || generateCacheKey(functionHash, deps, namespace);

  // Get cached entry
  const cachedEntry = enableCache ? cache.get<R>(cacheKey) : undefined;

  // Reset mounted state on mount and cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (abortOnUnmount && abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      // Clear interval on unmount
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [abortOnUnmount]);

  const fetchData = useCallback(
    async (isRefetch = false) => {
      if (!mountedRef.current) return;

      // If we have cached data and this is not a refetch, return cached data
      const existingEntry = enableCache ? cache.get<R>(cacheKey) : undefined;

      // Don't fetch if already loading (prevents double requests)
      if (existingEntry?.loading && !isRefetch) {
        return;
      }

      // If we have stale data and staleWhileRevalidate is enabled, don't show loading
      const hasStaleData =
        existingEntry?.data !== null && existingEntry?.data !== undefined;
      const shouldShowLoading =
        !staleWhileRevalidate || !hasStaleData || isRefetch;

      if (enableCache && shouldShowLoading) {
        cache.setLoading(cacheKey, true);
      }

      // Create new AbortController for this request
      if (abortOnUnmount) {
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }
        abortControllerRef.current = new AbortController();
      }

      try {
        if (enableCache) {
          cache.setError(cacheKey, null);
        }

        const signal = abortOnUnmount
          ? abortControllerRef.current?.signal
          : undefined;
        const result = await fetchFn(signal);

        if (!mountedRef.current) return;

        const finalData = transform
          ? transform(result)
          : (result as unknown as R);

        if (enableCache) {
          cache.set(cacheKey, finalData, ttl);
        }
      } catch (err) {
        if (!mountedRef.current) return;

        // Don't set error state if request was aborted
        if (err instanceof Error && err.name === "AbortError") {
          return;
        }

        const errorMessage =
          err instanceof Error ? err.message : "An unknown error occurred";

        if (enableCache) {
          cache.setError(cacheKey, errorMessage);
        }
      }
    },
    [
      abortOnUnmount,
      cache,
      cacheKey,
      enableCache,
      fetchFn,
      staleWhileRevalidate,
      transform,
      ttl,
    ]
  );

  // Effect for initial fetch and dependency changes
  useEffect(() => {
    if (immediate) {
      fetchData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [immediate, cacheKey]); // Use cacheKey instead of deps to avoid infinite loops

  // Effect for setting up polling interval
  useEffect(() => {
    if (refetchInterval && refetchInterval > 0) {
      intervalRef.current = setInterval(() => fetchData(true), refetchInterval);

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      };
    }
  }, [fetchData, refetchInterval, cacheKey]);

  // Determine current state
  const currentData =
    enableCache && cachedEntry ? cachedEntry.data : initialData;
  const currentLoading =
    enableCache && cachedEntry ? cachedEntry.loading : false;
  const currentError = enableCache && cachedEntry ? cachedEntry.error : null;
  const isFromCache = enableCache && !!cachedEntry;

  // Clear cache function
  const clearCache = () => {
    if (enableCache) {
      cache.clear(cacheKey);
    }
  };

  return {
    data: currentData,
    loading: currentLoading,
    error: currentError,
    refetch: () => fetchData(true),
    clearCache,
    isFromCache,
  };
}

// Utility hook to clear cache for specific patterns
export function useCacheClear() {
  const cache = useGlobalCache();

  return {
    clearAll: cache.clearAll,
    clearByPattern: (pattern: string) => {
      const keys = Object.keys(cache.cache).filter((key) =>
        key.includes(pattern)
      );
      keys.forEach((key) => cache.clear(key));
    },
    cleanup: cache.cleanup,
  };
}
