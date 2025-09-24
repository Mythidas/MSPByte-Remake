import { create } from "zustand";
import { SophosPartnerTenant } from "@workspace/shared/types/integrations/sophos-partner/tenants";

interface SophosTenantsState {
  tenants: Record<string, SophosPartnerTenant[]>; // integrationId -> tenants
  loading: Record<string, boolean>; // integrationId -> loading state
  setTenants: (integrationId: string, tenants: SophosPartnerTenant[]) => void;
  setLoading: (integrationId: string, loading: boolean) => void;
  getTenants: (integrationId: string) => SophosPartnerTenant[] | undefined;
  isLoading: (integrationId: string) => boolean;
}

export const useSophosTenantsStore = create<SophosTenantsState>((set, get) => ({
  tenants: {},
  loading: {},

  setTenants: (integrationId: string, tenants: SophosPartnerTenant[]) => {
    set((state) => ({
      tenants: { ...state.tenants, [integrationId]: tenants },
      loading: { ...state.loading, [integrationId]: false },
    }));
  },

  setLoading: (integrationId: string, loading: boolean) => {
    set((state) => ({
      loading: { ...state.loading, [integrationId]: loading },
    }));
  },

  getTenants: (integrationId: string) => {
    return get().tenants[integrationId];
  },

  isLoading: (integrationId: string) => {
    return get().loading[integrationId] ?? false;
  },
}));