"use client";

import React, { useEffect, useRef } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLazyTabsStore, useLazyTabsSync } from "@/lib/stores/lazy-tabs";

interface LazyTabsProps {
  id: string;
  defaultValue: string;
  className?: string;
  children: React.ReactNode;
  urlParam?: string; // URL search parameter name (defaults to 'tab')
  lazy?: boolean; // Enable lazy loading (defaults to true)
  orientation?: "horizontal" | "vertical";
}

interface LazyTabsContentProps {
  value: string;
  className?: string;
  children: React.ReactNode;
  forceRender?: boolean; // Force render even if not active
}

interface LazyTabsContextValue {
  tabsId: string;
  activeTab: string;
  isTabLoaded: (value: string) => boolean;
  lazy: boolean;
}

const LazyTabsContext = React.createContext<LazyTabsContextValue | null>(null);

export function LazyTabs({
  id,
  defaultValue,
  className,
  children,
  urlParam = "tab",
  lazy = true,
  orientation,
}: LazyTabsProps) {
  const store = useLazyTabsStore();
  const sync = useLazyTabsSync();
  const initialized = useRef(false);

  // Initialize immediately when component mounts (client-only)
  if (!initialized.current && typeof window !== 'undefined') {
    sync.initializeFromURL(id, defaultValue, urlParam);
    initialized.current = true;
  }

  // Sync to URL when active tab changes
  useEffect(() => {
    if (!initialized.current) return;

    const unsubscribe = useLazyTabsStore.subscribe(
      (state: any) => state.activeTabs[id],
      (currentTab: any) => {
        if (currentTab) {
          sync.syncToURL(id, urlParam);
        }
      }
    );

    return unsubscribe;
  }, [id, urlParam, sync]);

  // Clean up when component unmounts
  useEffect(() => {
    return () => {
      store.resetTabs(id);
    };
  }, [id]);

  const activeTab = store.getActiveTab(id) || defaultValue;
  const isTabLoaded = (value: string) => store.isTabLoaded(id, value);

  const handleValueChange = (value: string) => {
    store.setActiveTab(id, value);
  };

  const contextValue: LazyTabsContextValue = {
    tabsId: id,
    activeTab,
    isTabLoaded,
    lazy,
  };

  return (
    <LazyTabsContext.Provider value={contextValue}>
      <Tabs
        value={activeTab}
        onValueChange={handleValueChange}
        className={className}
        orientation={orientation}
      >
        {children}
      </Tabs>
    </LazyTabsContext.Provider>
  );
}

export function LazyTabsContent({
  value,
  className,
  children,
  forceRender = false,
}: LazyTabsContentProps) {
  const context = React.useContext(LazyTabsContext);

  if (!context) {
    throw new Error("LazyTabsContent must be used within LazyTabs");
  }

  const { tabsId, activeTab, isTabLoaded, lazy } = context;
  const store = useLazyTabsStore();

  const isActive = activeTab === value;
  const hasBeenLoaded = isTabLoaded(value);

  // Mark tab as loaded when it becomes active
  useEffect(() => {
    if (isActive && !hasBeenLoaded) {
      store.markTabAsLoaded(tabsId, value);
    }
  }, [isActive, hasBeenLoaded, store, tabsId, value]);

  // Render if active OR if it has been loaded before (keeps components mounted)
  const shouldRender = !lazy || forceRender || isActive || hasBeenLoaded;


  return (
    <div
      data-state={isActive ? "active" : "inactive"}
      data-orientation="horizontal"
      role="tabpanel"
      tabIndex={0}
      className={`mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${className}`}
      style={{ display: isActive ? "block" : "none" }}
    >
      {shouldRender ? children : null}
    </div>
  );
}

// Re-export original components for convenience
export { TabsList, TabsTrigger };

// Hook to use lazy tabs context
export function useLazyTabsContext() {
  const context = React.useContext(LazyTabsContext);

  if (!context) {
    throw new Error("useLazyTabsContext must be used within LazyTabs");
  }

  return context;
}

// Utility hook for checking if a specific tab is active
export function useIsTabActive(tabValue: string) {
  const { activeTab } = useLazyTabsContext();
  return activeTab === tabValue;
}

// Utility hook for checking if a specific tab has been loaded
export function useIsTabLoaded(tabValue: string) {
  const { isTabLoaded } = useLazyTabsContext();
  return isTabLoaded(tabValue);
}

// Utility hook to get all loaded tabs for the current LazyTabs instance
export function useLoadedTabs() {
  const { tabsId } = useLazyTabsContext();
  const store = useLazyTabsStore();
  return Array.from(store.getLoadedTabs(tabsId));
}