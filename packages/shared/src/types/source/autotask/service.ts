import { AutoTaskUserDefinedField } from "@workspace/shared/types/source/autotask/index.js";

export type AutoTaskService = {
  id: number;
  billingCodeID: number;
  createDate: string; // ISO date string
  creatorResourceID: number;
  description: string;
  invoiceDescription: string;
  isActive: boolean;
  lastModifiedDate: string; // ISO date string
  markupRate: number;
  name: string;
  periodType: number;
  serviceLevelAgreementID: number;
  unitCost: number;
  unitPrice: number;
  updateResourceID: number;
  vendorCompanyID: number | null;
  manufacturerServiceProvider: string;
  manufacturerServiceProviderProductNumber: string;
  catalogNumberPartNumber: string;
  sku: string;
  internalID: string;
  externalID: string;
  url: string;
  userDefinedFields: AutoTaskUserDefinedField[];
};
