import { Doc } from "@/lib/api";
import { create } from "zustand";
import { persist } from "zustand/middleware";

type Site = Doc<"sites">;

interface AppStore {
  // Current state
  currentSite: Site | null;

  // Actions
  setSite: (site: Site | null) => void;
  reset: () => void;
}

export const useAppStore = create<AppStore>()(
  persist(
    (set) => ({
      currentSite: null,

      setSite: (site) => set({ currentSite: site }),
      reset: () => set({ currentSite: null }),
    }),
    {
      name: "app-storage",
      partialize: (state) => ({
        // Only persist current site
        currentSite: state.currentSite,
      }),
    },
  ),
);
