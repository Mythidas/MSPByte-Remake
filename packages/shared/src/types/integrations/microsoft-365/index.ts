export type Microsoft365IntegrationConfig = {
  permission_version: number;
};

export type Microsoft365DataSourceConfig = {
  name: string;
  tenant_id: string;
  tenant_name: string;
  domain_mappings: {
    domain: string;
    site_id: string;
  }[];
  available_domains: {
    name: string;
    is_default: boolean;
    user_count: number;
  }[];
  permission_version: number;
};
