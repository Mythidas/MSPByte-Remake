import { create } from "zustand";

// Types for the global cache
export interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  loading: boolean;
  error: string | null;
  ttl?: number; // Time to live in milliseconds
}

// Types for DataTable cache
export interface TableState<T = any> {
  data: { rows: T[]; count: number };
  pagination: { page: number; pageSize: number };
  search: string;
  filters: any[];
  view: string | null;
  sort: { column: string; direction: "asc" | "desc" } | null;
  timestamp: number;
  ttl?: number;
}

interface GlobalCacheState {
  cache: Record<string, CacheEntry>;
  tableCache: Record<string, TableState>;

  // Core operations
  get: <T>(key: string) => CacheEntry<T> | undefined;
  set: <T>(key: string, data: T, ttl?: number) => void;
  setLoading: (key: string, loading: boolean) => void;
  setError: (key: string, error: string | null) => void;

  // Table cache operations
  getTableState: <T>(cacheKey: string) => TableState<T> | undefined;
  setTableState: <T>(cacheKey: string, state: Partial<TableState<T>>, ttl?: number) => void;
  updateTableData: <T>(cacheKey: string, updater: (data: { rows: T[]; count: number }) => { rows: T[]; count: number }) => void;
  addTableRow: <T>(cacheKey: string, row: T) => void;
  removeTableRow: <T>(cacheKey: string, rowId: any, idKey?: string) => void;
  updateTableRow: <T>(cacheKey: string, rowId: any, updater: (row: T) => T, idKey?: string) => void;

  // Cache management
  clear: (key: string) => void;
  clearAll: () => void;
  clearTableCache: (cacheKey: string) => void;
  isExpired: (key: string) => boolean;
  isTableExpired: (cacheKey: string) => boolean;
  cleanup: () => void; // Remove expired entries
}

export const useGlobalCache = create<GlobalCacheState>((set, get) => ({
  cache: {},
  tableCache: {},

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
    set({ cache: {}, tableCache: {} });
  },

  // Table cache operations
  getTableState: <T>(cacheKey: string) => {
    const state = get().tableCache[cacheKey] as TableState<T> | undefined;
    if (state && get().isTableExpired(cacheKey)) {
      get().clearTableCache(cacheKey);
      return undefined;
    }
    return state;
  },

  setTableState: <T>(cacheKey: string, state: Partial<TableState<T>>, ttl?: number) => {
    set((currentState) => ({
      tableCache: {
        ...currentState.tableCache,
        [cacheKey]: {
          ...currentState.tableCache[cacheKey],
          ...state,
          timestamp: Date.now(),
          ttl,
        },
      },
    }));
  },

  updateTableData: <T>(cacheKey: string, updater: (data: { rows: T[]; count: number }) => { rows: T[]; count: number }) => {
    const currentState = get().tableCache[cacheKey];
    if (currentState) {
      const newData = updater(currentState.data);
      get().setTableState(cacheKey, { data: newData });
    }
  },

  addTableRow: <T>(cacheKey: string, row: T) => {
    get().updateTableData(cacheKey, (data) => ({
      rows: [...data.rows, row],
      count: data.count + 1,
    }));
  },

  removeTableRow: <T>(cacheKey: string, rowId: any, idKey = 'id') => {
    get().updateTableData(cacheKey, (data) => ({
      rows: data.rows.filter((row: any) => row[idKey] !== rowId),
      count: data.count - 1,
    }));
  },

  updateTableRow: <T>(cacheKey: string, rowId: any, updater: (row: T) => T, idKey = 'id') => {
    get().updateTableData(cacheKey, (data) => ({
      ...data,
      rows: data.rows.map((row: any) =>
        row[idKey] === rowId ? updater(row) : row
      ),
    }));
  },

  clearTableCache: (cacheKey: string) => {
    set((state) => {
      const newTableCache = { ...state.tableCache };
      delete newTableCache[cacheKey];
      return { tableCache: newTableCache };
    });
  },

  isExpired: (key: string) => {
    const entry = get().cache[key];
    if (!entry || !entry.ttl) return false;
    return Date.now() - entry.timestamp > entry.ttl;
  },

  isTableExpired: (cacheKey: string) => {
    const state = get().tableCache[cacheKey];
    if (!state || !state.ttl) return false;
    return Date.now() - state.timestamp > state.ttl;
  },

  cleanup: () => {
    set((state) => {
      const newCache: Record<string, CacheEntry> = {};
      Object.entries(state.cache).forEach(([key, entry]) => {
        if (!entry.ttl || Date.now() - entry.timestamp <= entry.ttl) {
          newCache[key] = entry;
        }
      });

      const newTableCache: Record<string, TableState> = {};
      Object.entries(state.tableCache).forEach(([key, tableState]) => {
        if (!tableState.ttl || Date.now() - tableState.timestamp <= tableState.ttl) {
          newTableCache[key] = tableState;
        }
      });

      return { cache: newCache, tableCache: newTableCache };
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

// Utility functions for table cache operations
export const tableCache = {
  get: <T>(cacheKey: string) => useGlobalCache.getState().getTableState<T>(cacheKey),
  set: <T>(cacheKey: string, state: Partial<TableState<T>>, ttl?: number) =>
    useGlobalCache.getState().setTableState(cacheKey, state, ttl),
  updateData: <T>(cacheKey: string, updater: (data: { rows: T[]; count: number }) => { rows: T[]; count: number }) =>
    useGlobalCache.getState().updateTableData(cacheKey, updater),
  addRow: <T>(cacheKey: string, row: T) => useGlobalCache.getState().addTableRow(cacheKey, row),
  removeRow: <T>(cacheKey: string, rowId: any, idKey?: string) =>
    useGlobalCache.getState().removeTableRow(cacheKey, rowId, idKey),
  updateRow: <T>(cacheKey: string, rowId: any, updater: (row: T) => T, idKey?: string) =>
    useGlobalCache.getState().updateTableRow(cacheKey, rowId, updater, idKey),
  clear: (cacheKey: string) => useGlobalCache.getState().clearTableCache(cacheKey),
  isExpired: (cacheKey: string) => useGlobalCache.getState().isTableExpired(cacheKey),
};