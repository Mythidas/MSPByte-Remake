import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Site, ModeConfig } from "@/lib/types";

interface WardStore {
    // Current state
    currentSite: Site | null;
    currentMode: string | null; // 'home' | integration slug

    // Available options
    sites: Site[];
    availableModes: ModeConfig[];

    // Actions
    setSite: (site: Site | null) => void;
    setMode: (mode: string | null) => void;
    setSites: (sites: Site[]) => void;
    setAvailableModes: (modes: ModeConfig[]) => void;
    reset: () => void;
}

export const useWardStore = create<WardStore>()(
    persist(
        (set) => ({
            currentSite: null,
            currentMode: null,
            sites: [],
            availableModes: [],

            setSite: (site) => set({ currentSite: site }),
            setMode: (mode) => set({ currentMode: mode }),
            setSites: (sites) => set({ sites }),
            setAvailableModes: (modes) => set({ availableModes: modes }),
            reset: () => set({
                currentSite: null,
                currentMode: null,
                sites: [],
                availableModes: [],
            }),
        }),
        {
            name: "ward-storage",
            partialize: (state) => ({
                // Only persist current site/mode, not the lists
                currentSite: state.currentSite,
                currentMode: state.currentMode,
            }),
        }
    )
);
