import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

export interface LazyTabsState {
  // Map of tabsId -> activeTab
  activeTabs: Record<string, string>;
  // Map of tabsId -> Set of loaded tabs
  loadedTabs: Record<string, Set<string>>;
  // Map of tabsId -> default tab
  defaultTabs: Record<string, string>;

  // Actions
  setActiveTab: (tabsId: string, tabValue: string) => void;
  markTabAsLoaded: (tabsId: string, tabValue: string) => void;
  setDefaultTab: (tabsId: string, defaultTab: string) => void;
  getActiveTab: (tabsId: string) => string | undefined;
  isTabLoaded: (tabsId: string, tabValue: string) => boolean;
  getLoadedTabs: (tabsId: string) => Set<string>;
  resetTabs: (tabsId: string) => void;
}

export const useLazyTabsStore = create<LazyTabsState>()(
  subscribeWithSelector((set, get) => ({
    activeTabs: {},
    loadedTabs: {},
    defaultTabs: {},

    setActiveTab: (tabsId: string, tabValue: string) => {
      set((state) => {
        const newActiveTabs = { ...state.activeTabs };
        const newLoadedTabs = { ...state.loadedTabs };

        // Set the active tab
        newActiveTabs[tabsId] = tabValue;

        // Mark this tab as loaded
        if (!newLoadedTabs[tabsId]) {
          newLoadedTabs[tabsId] = new Set();
        }
        newLoadedTabs[tabsId].add(tabValue);

        return {
          activeTabs: newActiveTabs,
          loadedTabs: newLoadedTabs,
        };
      });
    },

    markTabAsLoaded: (tabsId: string, tabValue: string) => {
      set((state) => {
        const newLoadedTabs = { ...state.loadedTabs };
        if (!newLoadedTabs[tabsId]) {
          newLoadedTabs[tabsId] = new Set();
        }
        newLoadedTabs[tabsId].add(tabValue);
        return { loadedTabs: newLoadedTabs };
      });
    },

    setDefaultTab: (tabsId: string, defaultTab: string) => {
      set((state) => ({
        defaultTabs: { ...state.defaultTabs, [tabsId]: defaultTab }
      }));
    },

    getActiveTab: (tabsId: string) => {
      const state = get();
      return state.activeTabs[tabsId] || state.defaultTabs[tabsId];
    },

    isTabLoaded: (tabsId: string, tabValue: string) => {
      const state = get();
      return state.loadedTabs[tabsId]?.has(tabValue) ?? false;
    },

    getLoadedTabs: (tabsId: string) => {
      const state = get();
      return state.loadedTabs[tabsId] || new Set();
    },

    resetTabs: (tabsId: string) => {
      set((state) => {
        const newActiveTabs = { ...state.activeTabs };
        const newLoadedTabs = { ...state.loadedTabs };
        const newDefaultTabs = { ...state.defaultTabs };

        delete newActiveTabs[tabsId];
        delete newLoadedTabs[tabsId];
        delete newDefaultTabs[tabsId];

        return {
          activeTabs: newActiveTabs,
          loadedTabs: newLoadedTabs,
          defaultTabs: newDefaultTabs,
        };
      });
    },
  }))
);

// Helper hook for URL synchronization
export function useLazyTabsSync() {
  const store = useLazyTabsStore();

  return {
    syncFromURL: (tabsId: string, searchParam: string = 'tab') => {
      if (typeof window === 'undefined') return;

      const url = new URL(window.location.href);
      const tabFromURL = url.searchParams.get(searchParam);

      if (tabFromURL) {
        store.setActiveTab(tabsId, tabFromURL);
      }
    },

    syncToURL: (tabsId: string, searchParam: string = 'tab') => {
      if (typeof window === 'undefined') return;

      const activeTab = store.getActiveTab(tabsId);
      if (!activeTab) return;

      const url = new URL(window.location.href);
      url.searchParams.set(searchParam, activeTab);

      // Update URL without triggering navigation
      window.history.replaceState({}, '', url.toString());
    },

    initializeFromURL: (tabsId: string, defaultTab: string, searchParam: string = 'tab') => {
      if (typeof window === 'undefined') {
        store.setDefaultTab(tabsId, defaultTab);
        return;
      }

      store.setDefaultTab(tabsId, defaultTab);

      const url = new URL(window.location.href);
      const tabFromURL = url.searchParams.get(searchParam);

      if (tabFromURL) {
        store.setActiveTab(tabsId, tabFromURL);
      } else {
        store.setActiveTab(tabsId, defaultTab);
      }
    },
  };
}