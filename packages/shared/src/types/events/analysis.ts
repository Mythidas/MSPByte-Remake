import type { Id } from "@workspace/database/convex/_generated/dataModel.js";
import type { EntityType, IntegrationType } from "../integrations/index.js";

/**
 * Analysis Event - Emitted by workers after analyzing entities
 *
 * Workers perform domain-specific analysis (MFA, staleness, licenses, policies)
 * and emit findings without creating alerts. AlertManager subscribes to these
 * events and creates composite alerts based on aggregated findings.
 */
export interface AnalysisEvent {
  analysisId: string;
  tenantID: Id<"tenants">;
  dataSourceID: Id<"data_sources">;
  integrationID: Id<"integrations">;
  integrationType: IntegrationType;
  analysisType: string; // "mfa", "stale", "license", "policy"
  entityType: EntityType;
  findings: EntityFinding[];
  createdAt: number;
}

/**
 * Entity Finding - Analysis result for a single entity
 */
export interface EntityFinding {
  entityId: Id<"entities">;
  severity: "low" | "medium" | "high" | "critical";
  findings: Record<string, any>; // Domain-specific findings data
}

/**
 * MFA Analysis Finding - Specific to Microsoft365IdentitySecurityAnalyzer
 */
export interface MFAFinding extends EntityFinding {
  findings: {
    hasMFA: boolean;
    isPartial: boolean;
    isAdmin: boolean;
    securityDefaultsEnabled: boolean;
    reason?: string;
  };
}

/**
 * Stale User Analysis Finding - Specific to Microsoft365StaleUserAnalyzer
 */
export interface StaleUserFinding extends EntityFinding {
  findings: {
    isStale: boolean;
    daysSinceLogin: number;
    hasLicenses: boolean;
    isEnabled: boolean;
  };
}

/**
 * License Analysis Finding - Specific to Microsoft365LicenseAnalyzer
 */
export interface LicenseFinding extends EntityFinding {
  findings: {
    wastedLicenses: Array<{
      licenseSkuId: string;
      licenseName: string;
    }>;
    reason: "disabled" | "stale";
    userEnabled: boolean;
    userStale: boolean;
  };
}

/**
 * Policy Analysis Finding - Specific to Microsoft365PolicyAnalyzer
 */
export interface PolicyFinding extends EntityFinding {
  findings: {
    missingPolicies: string[];
    policyGaps: string[];
  };
}
