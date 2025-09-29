"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, AlertDescription } from "@workspace/ui/components/alert";
import { AlertCircle } from "lucide-react";
import Loader from "@workspace/ui/components/Loader";

// Types for the async data hook
export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export interface UseAsyncDataOptions<T, R = T> {
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
}

export interface UseAsyncRenderOptions {
  // Custom loading component
  LoadingComponent?: React.ComponentType;
  // Custom error component that receives error message as prop
  ErrorComponent?: React.ComponentType<{ error: string }>;
  // Custom wrapper component
  WrapperComponent?: React.ComponentType<{ children: React.ReactNode }>;
}

/**
 * Hook for managing async data fetching with loading states, error handling, and optional polling
 */
export function useAsyncData<T, R = T>(
  fetchFn: (signal?: AbortSignal) => Promise<T>,
  options: UseAsyncDataOptions<T, R> = {}
): AsyncState<R> {
  const {
    deps = [],
    transform,
    refetchInterval,
    initialData = null,
    immediate = true,
    abortOnUnmount = true,
  } = options;

  const [data, setData] = useState<R | null>(initialData);
  const [loading, setLoading] = useState(immediate);
  const [error, setError] = useState<string | null>(null);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);
  const triggeredRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Reset mounted state on mount and cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (abortOnUnmount && abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [abortOnUnmount]);

  const fetchData = useCallback(async () => {
    if (!mountedRef.current) return;

    // Create new AbortController for this request
    if (abortOnUnmount) {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();
    }

    try {
      setLoading(true);
      setError(null);

      const signal = abortOnUnmount
        ? abortControllerRef.current?.signal
        : undefined;
      const result = await fetchFn(signal);

      if (!mountedRef.current) return;

      const finalData = transform
        ? transform(result)
        : (result as unknown as R);
      setData(finalData);
    } catch (err) {
      if (!mountedRef.current) return;

      // Don't set error state if request was aborted
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }

      const errorMessage =
        err instanceof Error ? err.message : "An unknown error occurred";
      setError(errorMessage);
      setData(null);
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [abortOnUnmount, fetchFn, transform]);

  // Effect for initial fetch and dependency changes
  useEffect(() => {
    if (immediate && !triggeredRef.current) {
      triggeredRef.current = true;
      fetchData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [immediate, ...deps]);

  // Effect for setting up polling interval
  useEffect(() => {
    if (refetchInterval && refetchInterval > 0) {
      intervalRef.current = setInterval(fetchData, refetchInterval);

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      };
    }
  }, [refetchInterval, fetchData]);

  return {
    data,
    loading,
    error,
    refetch: fetchData,
  };
}

/**
 * Hook for rendering async data with automatic loading and error states
 */
export function useAsyncRender<T>(
  asyncState: AsyncState<T>,
  renderSuccess: (data: T) => React.ReactNode,
  options: UseAsyncRenderOptions = {}
): React.ReactNode {
  const {
    LoadingComponent = Loader,
    ErrorComponent = DefaultErrorComponent,
    WrapperComponent,
  } = options;

  const { data, loading, error } = asyncState;

  let content: React.ReactNode;

  if (loading) {
    content = <LoadingComponent />;
  } else if (error) {
    content = <ErrorComponent error={error} />;
  } else if (data !== null) {
    content = renderSuccess(data);
  } else {
    content = <ErrorComponent error="No data available" />;
  }

  if (WrapperComponent) {
    return <WrapperComponent>{content}</WrapperComponent>;
  }

  return content;
}

function DefaultErrorComponent({ error }: { error: string }) {
  return (
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertDescription>{error}</AlertDescription>
    </Alert>
  );
}

// Utility function for creating custom loading components
export function createLoadingComponent(
  content: React.ReactNode
): React.ComponentType {
  return function CustomLoadingComponent() {
    return <>{content}</>;
  };
}

// Utility function for creating custom error components
export function createErrorComponent(
  render: (error: string) => React.ReactNode
): React.ComponentType<{ error: string }> {
  return function CustomErrorComponent({ error }) {
    return <>{render(error)}</>;
  };
}
