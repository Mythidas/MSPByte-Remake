import { Doc } from "./_generated/dataModel";

export type UserJWT = {
  issuer: string;
  tokenIdentifier: string;
  subject: string;

  name: string;
  email: string;
  pictureUrl: string;
  emailVerified: boolean;

  org_id: string;
  org_name: string;
  org_role: string;

  updatedAt: string;
};

export type PaginationState = {
  page: number;
  pageSize: number;
  search?: string;
  sorting?: Record<string, "asc" | "desc">;
  filters?: Record<string, any>;
};

export type PaginatedResult<T> = {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
};

// Filter operators matching Supabase ORM
export type FilterOperator =
  | "eq"
  | "neq"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "in"
  | "contains"
  | "startsWith"
  | "endsWith";

export type Filter = {
  field: string;
  operator: FilterOperator;
  value: any;
};

// Sort direction
export type SortDirection = "asc" | "desc";

export type SortConfig = {
  field: string;
  direction: SortDirection;
};

/////////////////////////////////////////////////////
//////////////////// VIEWS //////////////////////////
/////////////////////////////////////////////////////

// Site types with computed fields (replaces sites_view)
export type SiteWithDetails = Doc<"sites"> & {
  psaIntegrationName?: string;
  parentName?: string;
  parentSlug?: string;
};

// User types with computed fields (replaces users_view)
export type UserWithDetails = Doc<"users"> & {
  roleName?: string;
  roleDescription?: string;
  roleRights?: any;
};

// Integration types with status
export type IntegrationWithStatus = Doc<"integrations"> & {
  isEnabled: boolean;
  dataSourceStatus?: "active" | "inactive" | "error";
};

// Data source with integration details
export type DataSourceWithIntegration = Doc<"data_sources"> & {
  integrationName: string;
  integrationSlug: string;
  siteName: string;
};

// Common query options
export type QueryOptions = {
  limit?: number;
  offset?: number;
  search?: string;
  filters?: Filter[];
  sort?: SortConfig;
};

// Mutation result
export type MutationResult<T = any> = {
  success: boolean;
  data?: T;
  error?: string;
};
