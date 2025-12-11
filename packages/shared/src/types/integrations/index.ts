// All entity types that can flow through the pipeline
export type EntityType =
  | "companies"
  | "endpoints"
  | "identities"
  | "firewalls"
  | "groups"
  | "roles"
  | "policies"
  | "licenses";

// Integration IDs matching schema integrationValidator
export type IntegrationId =
  | "microsoft-365"
  | "halopsa"
  | "sophos-partner"
  | "datto-rmm"
  | "msp-agent";
