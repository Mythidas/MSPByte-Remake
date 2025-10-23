export type SophosPartnerFirewall = {
  id: string;
  cluster: {
    id: string;
    mode: "activeActive" | "activePassive" | string;
    status: "primary" | "secondary" | string;
    peers: {
      id: string;
      serialNumber: string;
    };
  };
  tenant: {
    id: string;
  };
  serialNumber: string;
  group: {
    id: string;
    name: string;
  };
  hostname: string;
  name: string;
  externalIpv4Addresses?: string[];
  firmwareVersion: string | null;
  model: string | null;
  status: {
    managing: "approved" | "approvalPending" | "rejected" | string;
    reporting: "approved" | "approvalPending" | "rejected" | string;
    connected: boolean;
    suspended: boolean;
  };
  stateChangedAt: string; // ISO 8601 date string
  capabilities: string[];
  geoLocation: {
    latitude: string;
    longitude: string;
  };
  createdBy: {
    id: string;
    type: "user" | "system" | string;
    name: string;
    accountType: "tenant" | "partner" | string;
    accountId: string;
  };
  createdAt: string; // ISO 8601 date string
  updatedAt: string; // ISO 8601 date string
  updatedBy: {
    id: string;
    type: "user" | "system" | string;
    name: string;
    accountType: "tenant" | "partner" | string;
    accountId: string;
  };
  firmware?: SophosPartnerFirewallFirmware;
};

export type SophosPartnerFirewallFirmware = {
  id: string;
  serialNumber: string;
  firmwareVersion: string;
  upgradeToVersion: string[];
  newestFirmware: string;
};
