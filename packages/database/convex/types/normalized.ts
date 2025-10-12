export type Company = {
  external_id: string;
  external_parent_id?: string;

  name: string;
  parent_name?: string;
  type: "customer" | "prospect";

  created_at: string;
};

export type Endpoint = {
  external_id: string;

  hostname: string;
  status: "online" | "offline";
  os: string;

  ip_address: string;
  ext_address: string;
  mac_address: string;

  last_check_in: string;
};

export type Identity = {
  external_id: string;

  name: string;
  email: string;
  aliases: string[];
  type: "member" | "guest";
  enabled: boolean;

  licenses: string[];
  last_login_at: string;
};

export type Group = {
  external_id: string;
  external_parent_id?: string;

  name: string;
  type: "security" | "distribution" | "modern" | "custom";
  description?: string;

  created_at: string;
};
