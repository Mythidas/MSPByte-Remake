export type MSGraphSubscribedSku = {
  skuId: string;
  skuPartNumber: string;
  servicePlans: Array<{
    servicePlanId: string;
    servicePlanName: string;
  }>;
  prepaidUnits?: {
    enabled: number;
    suspended: number;
    warning: number;
  };
  consumedUnits?: number;
};

export type M365NormalLicense = {
  accountId: string;
  accountName: string;
  appliesTo: "User" | "Company" | string;
  capabilityStatus: "Enabled" | "Disabled" | string;
  consumedUnits: number;
  friendlyName: string;
  id: string;

  prepaidUnits: {
    enabled: number;
    lockedOut: number;
    suspended: number;
    warning: number;
  };

  servicePlans: {
    appliesTo: "User" | "Company" | string;
    provisioningStatus: "Success" | "Disabled" | "Pending" | string;
    servicePlanId: string;
    servicePlanName: string;
    servicePlanType: string;
  }[];

  skuId: string;
  skuPartNumber: string;
  subscriptionIds: string[];
};