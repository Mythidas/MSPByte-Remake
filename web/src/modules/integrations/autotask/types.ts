import { Database } from "@workspace/shared/types/database/import";

// Type for the autotask_companies_view
export type AutoTaskCompanyView = Database["views"]["Views"]["autotask_companies_view"]["Row"];

// Processed type for the component (with camelCase naming)
export type AutoTaskCompany = {
  id: string;
  external_id: string;
  integration_id: string;
  tenant_id: string;
  name: string | null;
  created_at: string;
  updated_at: string;
  isLinked: boolean;
  linkedSiteId: string | null;
  linkedSiteName: string | null;
  linkedSiteSlug: string | null;
  linkedSiteStatus: string | null;
};