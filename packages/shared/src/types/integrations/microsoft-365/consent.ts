export type M365ConsentState = {
  action: 'initial';
  tenantId: string; // MSPByte tenant ID
  dataSourceId: string; // Data source ID to update
  name: string; // User-provided connection name
  timestamp: number;
};

export type M365ConsentCallbackParams = {
  tenant: string; // Microsoft tenant ID
  state: string; // Encoded M365ConsentState
  admin_consent?: string; // 'True' or 'False'
  error?: string;
  error_description?: string;
};

export type M365TokenResponse = {
  token_type: string;
  expires_in: number;
  access_token: string;
};

export type M365TenantInfo = {
  id: string;
  displayName: string;
  verifiedDomains: Array<{
    name: string;
    isDefault: boolean;
    capabilities: string;
  }>;
};

export type M365DomainWithUserCount = {
  name: string;
  isDefault: boolean;
  userCount: number;
};
