import { Tables } from "@workspace/shared/types/database";
import { create } from "zustand";

interface SiteState {
  site: Tables<"sites_view"> | null;
  setSite: (site: Tables<"sites_view"> | null) => void;
}

export const useSiteStore = create<SiteState>((set) => ({
  site: null,
  setSite: (site) => set({ site: site }),
}));
