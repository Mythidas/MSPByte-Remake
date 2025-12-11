export type SophosPartnerLicense = {
  organization: {
    id: string; // UUID
  };
  tenant?: {
    id: string; // UUID
  };
  licenses: SophosLicense[];
};

export type SophosLicense = {
  id: string;
  licenseIdentifier: string;
  product: {
    code: string;
    name?: string;
    genericCode?: string;
  };
  startDate: string; // ISO date (UTC start of day)
  endDate?: string; // ISO date (UTC end of day, optional for perpetual)
  perpetual: boolean;
  type: "trial" | "term" | "usage" | "ordered" | "enterprise" | "perpetual";
  quantity?: number;
  unlimited: boolean;
  usage?: {
    current: {
      [key: string]: number | string | boolean | null; // structure unspecified
    };
  };
};
