import { AutoTaskUserDefinedField } from "src/types/autotask/generic.js";

export type AutoTaskContract = {
  id: number;
  billingPreference: number;
  billToCompanyContactID: number | null;
  billToCompanyID: number | null;
  companyID: number;
  contactID: number;
  contactName: string;
  contractCategory: number;
  contractExclusionSetID: number | null;
  contractName: string;
  contractNumber: string | null;
  contractPeriodType: number;
  contractType: number;
  description: string | null;
  endDate: string; // ISO date string
  estimatedCost: number;
  estimatedHours: number;
  estimatedRevenue: number;
  exclusionContractID: number | null;
  internalCurrencyOverageBillingRate: number | null;
  internalCurrencySetupFee: number;
  isCompliant: boolean;
  isDefaultContract: boolean;
  lastModifiedDateTime: string; // ISO date string
  opportunityID: number;
  organizationalLevelAssociationID: number;
  overageBillingRate: number | null;
  purchaseOrderNumber: string;
  renewedContractID: number | null;
  serviceLevelAgreementID: number | null;
  setupFee: number;
  setupFeeBillingCodeID: number | null;
  startDate: string; // ISO date string
  status: number;
  timeReportingRequiresStartAndStopTimes: number;
  userDefinedFields: AutoTaskUserDefinedField[];
};

export type AutoTaskContractService = {
  id: number;
  contractID: number;
  internalCurrencyAdjustedPrice: number;
  internalCurrencyUnitPrice: number;
  internalDescription: string;
  invoiceDescription: string;
  quoteItemID: number;
  serviceID: number;
  unitCost: number;
  unitPrice: number;
};

export type AutoTaskContractServiceUnits = {
  id: number;
  approveAndPostDate: string; // ISO date string
  contractID: number;
  contractServiceID: number;
  cost: number;
  endDate: string; // ISO date string
  internalCurrencyPrice: number;
  organizationalLevelAssociationID: number;
  price: number;
  serviceID: number;
  startDate: string; // ISO date string
  units: number;
  vendorCompanyID: number | null;
};
