export type SophosPartnerConfig = {
  client_id: string;
  client_secret: string;
};

export type SophosTenantConfig = {
  api_host: string;
  tenant_name: string;
  tenant_id: string;
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
