export type DattoRMMConfig = {
  url: string; // API base URL
  apiKey: string; // API key (encrypted)
  apiSecretKey: string; // API secret key (encrypted)
  siteVariableName?: string; // Configurable site variable name (default: "MSPSiteCode")
};

export type DattoRMMPagination = {
  page: number;
  pageSize: number;
  totalRecords: number;
};
