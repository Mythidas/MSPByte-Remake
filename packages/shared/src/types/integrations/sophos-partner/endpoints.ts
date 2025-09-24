export type SophosPartnerEndpoint = {
  id: string;
  os: {
    name: string;
    build: number;
    isServer: boolean;
    platform: string;
    majorVersion: number;
    minorVersion: number;
  };
  type: string;
  health: {
    overall: "good" | "bad" | string;
    threats: {
      status: "good" | "bad" | string;
    };
    services: {
      status: "good" | "bad" | string;
      serviceDetails: {
        name: string;
        status: "running" | "stopped" | string;
      }[];
    };
  };
  online: boolean;
  tenant: {
    id: string;
  };
  modules: {
    name: string;
    version: string;
  }[];
  hostname: string;
  lockdown: {
    status: "enabled" | "disabled" | "unavailable" | string;
  };
  packages?: {
    ztna?: {
      status: "assigned" | "unassigned" | string;
    };
    encryption?: {
      status: "assigned" | "unassigned" | string;
      available?: {
        id: string;
        name: string;
      }[];
    };
    protection?: {
      name: string;
      status: "assigned" | "unassigned" | string;
      available?: {
        id: string;
        name: string;
      }[];
      assignedId?: string;
    };
  };
  isolation: {
    status: "isolated" | "notIsolated" | string;
  };
  lastSeenAt: string; // ISO timestamp
  mdrManaged: boolean;
  macAddresses?: string[];
  ipv4Addresses?: string[];
  assignedProducts: {
    code: string;
    status: "installed" | "notInstalled" | string;
    version: string;
  }[];
  associatedPerson: {
    id: string;
    name: string;
    viaLogin: string;
  };
  tamperProtectionEnabled: boolean;
  tamperProtectionSupported: boolean;
};
