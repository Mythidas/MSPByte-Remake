import { Doc } from "@/lib/api";
import { Integration } from "@workspace/shared/types/integrations/config.js";
import { create } from "zustand";
import { persist } from "zustand/middleware";

type Site = Doc<"sites">;
type Mode = Integration;

interface AppStore {
  // Current state
  currentSite: Site | null;
  currentMode: Mode | null; // 'home' | integration slug
  availableModes: Mode[];

  // Actions
  setSite: (site: Site | null) => void;
  setMode: (mode: Mode | null) => void;
  setAvailableModes: (modes: Mode[]) => void;
  reset: () => void;
}

export const useAppStore = create<AppStore>()(
  persist(
    (set) => ({
      currentSite: null,
      currentMode: null,
      availableModes: [],

      setSite: (site) => set({ currentSite: site }),
      setMode: (mode) => set({ currentMode: mode }),
      setAvailableModes: (modes) => set({ availableModes: modes }),
      reset: () =>
        set({
          currentSite: null,
          currentMode: null,
          availableModes: [],
        }),
    }),
    {
      name: "app-storage",
      partialize: (state) => ({
        // Only persist current site/mode, not the lists
        currentSite: state.currentSite,
        currentMode: state.currentMode,
      }),
    },
  ),
);
