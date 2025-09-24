import { create } from "zustand";

// Types for the global cache
export interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  loading: boolean;
  error: string | null;
  ttl?: number; // Time to live in milliseconds
}

interface GlobalCacheState {
  cache: Record<string, CacheEntry>;

  // Core operations
  get: <T>(key: string) => CacheEntry<T> | undefined;
  set: <T>(key: string, data: T, ttl?: number) => void;
  setLoading: (key: string, loading: boolean) => void;
  setError: (key: string, error: string | null) => void;

  // Cache management
  clear: (key: string) => void;
  clearAll: () => void;
  isExpired: (key: string) => boolean;
  cleanup: () => void; // Remove expired entries
}

export const useGlobalCache = create<GlobalCacheState>((set, get) => ({
  cache: {},

  get: <T>(key: string) => {
    const entry = get().cache[key] as CacheEntry<T> | undefined;
    if (entry && get().isExpired(key)) {
      get().clear(key);
      return undefined;
    }
    return entry;
  },

  set: <T>(key: string, data: T, ttl?: number) => {
    set((state) => ({
      cache: {
        ...state.cache,
        [key]: {
          data,
          timestamp: Date.now(),
          loading: false,
          error: null,
          ttl,
        },
      },
    }));
  },

  setLoading: (key: string, loading: boolean) => {
    set((state) => ({
      cache: {
        ...state.cache,
        [key]: {
          ...state.cache[key],
          loading,
          timestamp: state.cache[key]?.timestamp || Date.now(),
        },
      },
    }));
  },

  setError: (key: string, error: string | null) => {
    set((state) => ({
      cache: {
        ...state.cache,
        [key]: {
          ...state.cache[key],
          error,
          loading: false,
          timestamp: state.cache[key]?.timestamp || Date.now(),
        },
      },
    }));
  },

  clear: (key: string) => {
    set((state) => {
      const newCache = { ...state.cache };
      delete newCache[key];
      return { cache: newCache };
    });
  },

  clearAll: () => {
    set({ cache: {} });
  },

  isExpired: (key: string) => {
    const entry = get().cache[key];
    if (!entry || !entry.ttl) return false;
    return Date.now() - entry.timestamp > entry.ttl;
  },

  cleanup: () => {
    set((state) => {
      const newCache: Record<string, CacheEntry> = {};
      Object.entries(state.cache).forEach(([key, entry]) => {
        if (!entry.ttl || Date.now() - entry.timestamp <= entry.ttl) {
          newCache[key] = entry;
        }
      });
      return { cache: newCache };
    });
  },
}));

// Utility to generate cache keys
export function generateCacheKey(
  functionName: string,
  deps: any[] = [],
  namespace?: string
): string {
  const depsString = JSON.stringify(deps);
  const base = `${functionName}:${depsString}`;
  return namespace ? `${namespace}:${base}` : base;
}

// Utility to hash function for unique identification
export function getFunctionHash(fn: Function): string {
  return fn.toString().slice(0, 50).replace(/\s+/g, '');
}