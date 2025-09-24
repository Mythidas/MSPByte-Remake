export type SophosPartnerTenant = {
  id: string;
  name: string;
  showAs: string;
  status: "active" | "inactive" | string; // refine if there are only specific statuses
  apiHost: string;
  contact: {
    email: string;
    address: {
      city: string;
      state: string;
      address1: string;
      postalCode: string;
      countryCode: string;
    };
    lastName: string;
    firstName: string;
  };
  partner: {
    id: string;
  };
  products: {
    code: string;
  }[];
  dataRegion: string;
  billingType: "usage" | "subscription" | string; // adjust if known fixed values
  organization: {
    id: string;
  };
  dataGeography: string;
};
