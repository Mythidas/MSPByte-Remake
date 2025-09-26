export type MSGraphGroup = {
  id: string;
  deletedDateTime: string | null;
  classification: string | null;
  createdDateTime: string;
  description: string | null;
  displayName: string;
  expirationDateTime: string | null;
  groupTypes: string[]; // e.g., ["Unified"]
  isAssignableToRole: boolean | null;
  mail: string | null;
  mailEnabled: boolean;
  mailNickname: string;
  membershipRule: string | null;
  membershipRuleProcessingState: string | null;
  onPremisesLastSyncDateTime: string | null;
  onPremisesSecurityIdentifier: string | null;
  onPremisesSyncEnabled: boolean | null;
  preferredDataLocation: string | null;
  preferredLanguage: string | null;
  proxyAddresses: string[];
  renewedDateTime: string;
  resourceBehaviorOptions: string[];
  resourceProvisioningOptions: string[];
  securityEnabled: boolean;
  serviceProvisioningErrors?: any[]; // Only present on some objects
  theme: string | null;
  visibility: string | null;
  onPremisesProvisioningErrors: any[];
};
