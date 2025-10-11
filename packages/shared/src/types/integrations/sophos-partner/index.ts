export type SophosPartnerConfig = {
  clientId: string;
  clientSecret: string;
};

export type SophosTenantConfig = {
  apiHost: string;
  tenantName: string;
  tenantId: string;
};

export type SophosPartnerAPIResponse<T> = {
  items: T[];
  pages: {
    total: number;
    current: number;
  };
};

// Re-export types from submodules
export type { SophosPartnerTenant } from "./tenants";
