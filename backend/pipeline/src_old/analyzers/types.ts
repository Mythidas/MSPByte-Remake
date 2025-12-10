/**
 * Analysis Types - TypeScript interfaces for UnifiedAnalyzer
 *
 * These types define the structure of findings emitted by the UnifiedAnalyzer
 * and maintain compatibility with existing alert structures.
 */

import type { Id } from "@workspace/database/convex/_generated/dataModel.js";

/**
 * Severity levels for findings
 */
export type FindingSeverity = "low" | "medium" | "high" | "critical";

/**
 * Analysis types supported by UnifiedAnalyzer
 */
export type AnalysisType = "mfa" | "policy" | "license" | "stale";

/**
 * Alert types that can be created from findings
 */
export type AlertType =
  | "mfa_not_enforced"
  | "mfa_partial_enforced"
  | "policy_gap"
  | "license_waste"
  | "license_overuse"
  | "stale_user";

/**
 * Base finding structure (common fields)
 */
export interface BaseFinding {
  entityId: Id<"entities">;
  alertType: AlertType;
  severity: FindingSeverity;
  message: string;
  metadata: Record<string, any>;
}

/**
 * MFA Analysis Finding
 */
export interface MFAFinding extends BaseFinding {
  alertType: "mfa_not_enforced" | "mfa_partial_enforced";
  metadata: {
    hasMFA: boolean;
    isPartial: boolean;
    isAdmin: boolean;
    securityDefaultsEnabled: boolean;
    mfaPolicies: Array<{
      policyId: string;
      policyName: string;
      fullCoverage: boolean;
    }>;
    reason?: string;
  };
}

/**
 * Policy Gap Finding
 */
export interface PolicyFinding extends BaseFinding {
  alertType: "policy_gap";
  metadata: {
    isAdmin: boolean;
    securityDefaultsEnabled: boolean;
    enabledPoliciesCount: number;
    missingPolicies: string[];
  };
}

/**
 * License Waste Finding
 */
export interface LicenseWasteFinding extends BaseFinding {
  alertType: "license_waste";
  metadata: {
    wastedLicenses: Array<{
      licenseSkuId: string;
      licenseName: string;
    }>;
    reason: "disabled" | "stale";
    userEnabled: boolean;
    userStale: boolean;
    daysSinceLogin?: number;
  };
}

/**
 * License Overuse Finding
 */
export interface LicenseOveruseFinding extends BaseFinding {
  alertType: "license_overuse";
  metadata: {
    licenseName: string;
    licenseSkuId: string;
    consumed: number;
    total: number;
    overage: number;
  };
}

/**
 * Stale User Finding
 */
export interface StaleUserFinding extends BaseFinding {
  alertType: "stale_user";
  metadata: {
    isStale: boolean;
    daysSinceLogin: number;
    hasLicenses: boolean;
    isEnabled: boolean;
    isAdmin: boolean;
    lastLoginAt: string;
  };
}

/**
 * Union type for all finding types
 */
export type Finding =
  | MFAFinding
  | PolicyFinding
  | LicenseWasteFinding
  | LicenseOveruseFinding
  | StaleUserFinding;

/**
 * Analysis results by type
 */
export interface AnalysisResults {
  mfa: MFAFinding[];
  policy: PolicyFinding[];
  license: (LicenseWasteFinding | LicenseOveruseFinding)[];
  stale: StaleUserFinding[];
}

/**
 * Unified Analysis Event (published to NATS)
 */
export interface UnifiedAnalysisEvent {
  tenantId: Id<"tenants">;
  dataSourceId: Id<"data_sources">;
  syncId: string;
  integrationType: string;

  // Which analysis types ran
  analysisTypes: AnalysisType[];

  // Findings by type (empty array = analysis ran, no issues found)
  findings: AnalysisResults;

  // Entity counts (for context)
  entityCounts: {
    identities: number;
    groups: number;
    roles: number;
    policies: number;
    licenses: number;
  };

  // Statistics
  stats: {
    totalFindings: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    analysisTimeMs: number;
    loadTimeMs: number;
    queryCount: number;
  };

  createdAt: number;
}

/**
 * Linked Event Payload (received from Linker)
 */
export interface LinkedEventPayload {
  eventID: string;
  tenantID: Id<"tenants">;
  dataSourceID: Id<"data_sources">;
  integrationID: Id<"integrations">;
  integrationType: string;
  entityType: string;
  stage: "linked";
  changedEntityIds?: Id<"entities">[];
  syncMetadata?: {
    cursor?: string;
    hasMore?: boolean;
    totalProcessed?: number;
  };
  createdAt: number;
}

/**
 * Debounced Analysis Params
 */
export interface DebounceAnalysisParams {
  tenantId: Id<"tenants">;
  dataSourceId: Id<"data_sources">;
  syncId: string;
  changedEntityIds: Set<Id<"entities">>;
  entityTypes: Set<string>;
}
