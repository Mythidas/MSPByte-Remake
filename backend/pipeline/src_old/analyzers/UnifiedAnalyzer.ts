/**
 * UnifiedAnalyzer - Consolidates 5 separate analyzers into one
 *
 * This analyzer eliminates redundant database queries by:
 * 1. Using DataContextLoader to fetch all data once (7-10 queries vs 800+)
 * 2. Running all analysis types in parallel with shared context
 * 3. Emitting explicit findings so AlertManager knows when analysis ran
 *
 * Performance:
 * - Before: 800-1400 queries, 15+ minutes
 * - After: 7-10 queries, ~30 seconds
 *
 * Fixes:
 * - MFA alert bug: Explicit findings allow proper alert resolution
 */

import { natsClient } from "../lib/nats.js";
import Logger from "../lib/logger.js";
import TracingManager from "../lib/tracing.js";
import DataContextLoader from "../context/DataContextLoader.js";
import type { AnalysisContext } from "../context/AnalysisContext.js";
import {
  getIdentitiesToAnalyze,
  getPoliciesForIdentity,
  doesPolicyApply,
  getGroupsForIdentity,
  getLicensesForIdentity,
  isAdmin,
  getEnabledIdentities,
} from "../context/AnalysisHelpers.js";
import type {
  LinkedEventPayload,
  UnifiedAnalysisEvent,
  AnalysisResults,
  MFAFinding,
  PolicyFinding,
  LicenseWasteFinding,
  LicenseOveruseFinding,
  StaleUserFinding,
  DebounceAnalysisParams,
} from "./types.js";
import type { Id } from "@workspace/database/convex/_generated/dataModel.js";

const DEBOUNCE_MS = 5 * 60 * 1000; // 5 minutes
const STALE_THRESHOLD_DAYS = 90;

export class UnifiedAnalyzer {
  private loader: DataContextLoader;
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private pendingAnalysis: Map<string, DebounceAnalysisParams> = new Map();

  constructor() {
    this.loader = new DataContextLoader();
  }

  /**
   * Initialize the analyzer and subscribe to linked events
   */
  async initialize(): Promise<void> {
    Logger.log({
      module: "UnifiedAnalyzer",
      context: "initialize",
      message: "Initializing UnifiedAnalyzer",
    });

    // Subscribe to all linked.* events
    await natsClient.subscribe("linked.>", this.handleLinkedEvent.bind(this));

    Logger.log({
      module: "UnifiedAnalyzer",
      context: "initialize",
      message: "UnifiedAnalyzer initialized and subscribed to linked.* events",
    });
  }

  /**
   * Handle linked event with debouncing
   */
  private async handleLinkedEvent(event: LinkedEventPayload): Promise<void> {
    const { tenantID, dataSourceID, eventID, entityType, changedEntityIds } =
      event;
    const key = `${tenantID}:${dataSourceID}`;

    Logger.log({
      module: "UnifiedAnalyzer",
      context: "handleLinkedEvent",
      message: `Received linked.${entityType} event`,
      metadata: {
        eventID,
        tenantID,
        dataSourceID,
        changedCount: changedEntityIds?.length || 0,
      },
    });

    // Get or create pending analysis params
    let params = this.pendingAnalysis.get(key);
    if (!params) {
      params = {
        tenantId: tenantID,
        dataSourceId: dataSourceID,
        syncId: eventID,
        changedEntityIds: new Set(),
        entityTypes: new Set(),
      };
      this.pendingAnalysis.set(key, params);
    }

    // Accumulate changed entities and types
    if (changedEntityIds) {
      changedEntityIds.forEach((id) => params!.changedEntityIds.add(id));
    }
    params.entityTypes.add(entityType);

    // Clear existing timer
    const existingTimer = this.debounceTimers.get(key);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new debounce timer
    const timer = setTimeout(async () => {
      this.debounceTimers.delete(key);
      const analysisParams = this.pendingAnalysis.get(key);
      this.pendingAnalysis.delete(key);

      if (analysisParams) {
        await this.execute(analysisParams);
      }
    }, DEBOUNCE_MS);

    this.debounceTimers.set(key, timer);

    Logger.log({
      module: "UnifiedAnalyzer",
      context: "handleLinkedEvent",
      message: `Debounced analysis for ${DEBOUNCE_MS / 1000}s`,
      metadata: {
        accumulatedEntities: params.changedEntityIds.size,
        accumulatedTypes: Array.from(params.entityTypes),
      },
    });
  }

  /**
   * Execute unified analysis
   */
  private async execute(params: DebounceAnalysisParams): Promise<void> {
    const { tenantId, dataSourceId, syncId, changedEntityIds } = params;
    const startTime = Date.now();

    Logger.log({
      module: "UnifiedAnalyzer",
      context: "execute",
      message: "Starting unified analysis",
      metadata: {
        tenantId,
        dataSourceId,
        syncId,
        changedCount: changedEntityIds.size,
      },
    });

    // Start tracing
    TracingManager.startTrace({
      tenantId,
      dataSourceId,
      syncId,
      stage: "unified-analysis",
      metadata: { changedCount: changedEntityIds.size },
    });

    try {
      // Load context once (7-10 queries)
      const contextLoadStart = Date.now();
      const context = await this.loader.load(tenantId, dataSourceId, {
        changedEntityIds: Array.from(changedEntityIds),
      });
      const loadTimeMs = Date.now() - contextLoadStart;

      Logger.log({
        module: "UnifiedAnalyzer",
        context: "execute",
        message: "Context loaded",
        metadata: {
          loadTimeMs,
          queryCount: context.stats.queryCount,
          totalEntities: context.stats.totalEntities,
        },
      });

      // Run all analysis in parallel (0 additional queries!)
      const analysisStart = Date.now();
      const [mfaFindings, policyFindings, licenseFindings, staleFindings] =
        await Promise.all([
          this.analyzeMFA(context),
          this.analyzePolicyGaps(context),
          this.analyzeLicenses(context),
          this.analyzeStaleUsers(context),
        ]);
      const analysisTimeMs = Date.now() - analysisStart;

      const results: AnalysisResults = {
        mfa: mfaFindings,
        policy: policyFindings,
        license: licenseFindings,
        stale: staleFindings,
      };

      // Count findings by severity
      const allFindings = [
        ...mfaFindings,
        ...policyFindings,
        ...licenseFindings,
        ...staleFindings,
      ];
      const stats = {
        totalFindings: allFindings.length,
        critical: allFindings.filter((f) => f.severity === "critical").length,
        high: allFindings.filter((f) => f.severity === "high").length,
        medium: allFindings.filter((f) => f.severity === "medium").length,
        low: allFindings.filter((f) => f.severity === "low").length,
        analysisTimeMs,
        loadTimeMs,
        queryCount: context.stats.queryCount,
      };

      Logger.log({
        module: "UnifiedAnalyzer",
        context: "execute",
        message: "Analysis complete",
        metadata: {
          stats,
          findingsByType: {
            mfa: mfaFindings.length,
            policy: policyFindings.length,
            license: licenseFindings.length,
            stale: staleFindings.length,
          },
        },
      });

      // Emit unified findings
      await this.emitFindings(context, results, stats, syncId);

      const totalTimeMs = Date.now() - startTime;
      Logger.log({
        module: "UnifiedAnalyzer",
        context: "execute",
        message: `Unified analysis completed in ${totalTimeMs}ms`,
        metadata: { totalTimeMs, stats },
      });

      TracingManager.addMetadata("analysisStats", stats);
    } catch (error) {
      Logger.log({
        module: "UnifiedAnalyzer",
        context: "execute",
        message: `Analysis failed: ${error}`,
        level: "error",
        error: error as Error,
      });
      throw error;
    }
  }

  /**
   * Analyze MFA enforcement
   */
  private async analyzeMFA(context: AnalysisContext): Promise<MFAFinding[]> {
    const findings: MFAFinding[] = [];
    const identitiesToAnalyze = getIdentitiesToAnalyze(context, false); // Analyze all

    // Find Security Defaults policy
    const securityDefaults = context.policies.find(
      (p) => p.externalId === "security-defaults",
    );
    const securityDefaultsEnabled =
      securityDefaults?.normalizedData.status === "enabled";

    // Find MFA-enforcing policies
    const mfaPolicies = context.policies.filter((policy) => {
      if (policy.normalizedData.status !== "enabled") return false;
      const rawData = policy.rawData as any;
      const grantControls = rawData?.grantControls?.builtInControls || [];
      return grantControls.includes("mfa");
    });

    for (const identity of identitiesToAnalyze) {
      const identityIsAdmin = isAdmin(context, identity._id);

      let hasMFA = false;
      let isPartial = false;
      const applicablePolicies: Array<{
        policyId: string;
        policyName: string;
        fullCoverage: boolean;
      }> = [];

      // Check Security Defaults
      if (securityDefaultsEnabled) {
        hasMFA = true;
        isPartial = !identityIsAdmin; // Security Defaults is partial for non-admins
      }

      // Check Conditional Access policies
      for (const policy of mfaPolicies) {
        if (doesPolicyApply(context, policy._id, identity._id)) {
          hasMFA = true;
          const rawData = policy.rawData as any;
          const fullCoverage =
            rawData?.conditions?.applications?.includeApplications?.includes(
              "All",
            ) || false;

          applicablePolicies.push({
            policyId: policy._id,
            policyName: policy.normalizedData.name || "",
            fullCoverage,
          });

          if (!fullCoverage) {
            isPartial = true;
          }
        }
      }

      // Create findings
      if (!hasMFA) {
        findings.push({
          entityId: identity._id,
          alertType: "mfa_not_enforced",
          severity: identityIsAdmin ? "critical" : "high",
          message: identityIsAdmin
            ? "Admin user has no MFA enforcement"
            : "User has no MFA enforcement",
          metadata: {
            hasMFA: false,
            isPartial: false,
            isAdmin: identityIsAdmin,
            securityDefaultsEnabled,
            mfaPolicies: [],
            reason: "No MFA policy applies to this user",
          },
        });
      } else if (isPartial) {
        findings.push({
          entityId: identity._id,
          alertType: "mfa_partial_enforced",
          severity: identityIsAdmin ? "high" : "medium",
          message: identityIsAdmin
            ? "Admin user has partial MFA enforcement"
            : "User has partial MFA enforcement",
          metadata: {
            hasMFA: true,
            isPartial: true,
            isAdmin: identityIsAdmin,
            securityDefaultsEnabled,
            mfaPolicies: applicablePolicies,
            reason: "MFA only enforced for some applications",
          },
        });
      }
    }

    return findings;
  }

  /**
   * Analyze policy coverage gaps
   */
  private async analyzePolicyGaps(
    context: AnalysisContext,
  ): Promise<PolicyFinding[]> {
    const findings: PolicyFinding[] = [];
    const identitiesToAnalyze = getIdentitiesToAnalyze(context, false);

    // Find Security Defaults
    const securityDefaults = context.policies.find(
      (p) => p.externalId === "security-defaults",
    );
    const securityDefaultsEnabled =
      securityDefaults?.normalizedData.status === "enabled";

    // Get enabled policies
    const enabledPolicies = context.policies.filter(
      (p) =>
        p.normalizedData.status === "enabled" &&
        p.externalId !== "security-defaults",
    );

    for (const identity of identitiesToAnalyze) {
      let coveredByPolicy = securityDefaultsEnabled;

      // Check if any enabled policy applies
      if (!coveredByPolicy) {
        for (const policy of enabledPolicies) {
          if (doesPolicyApply(context, policy._id, identity._id)) {
            coveredByPolicy = true;
            break;
          }
        }
      }

      if (!coveredByPolicy) {
        const identityIsAdmin = isAdmin(context, identity._id);

        findings.push({
          entityId: identity._id,
          alertType: "policy_gap",
          severity: identityIsAdmin ? "high" : "medium",
          message: identityIsAdmin
            ? "Admin user has no security policy coverage"
            : "User has no security policy coverage",
          metadata: {
            isAdmin: identityIsAdmin,
            securityDefaultsEnabled,
            enabledPoliciesCount: enabledPolicies.length,
            missingPolicies: [
              "No Conditional Access or Security Defaults policy applies",
            ],
          },
        });
      }
    }

    return findings;
  }

  /**
   * Analyze license waste and overuse
   */
  private async analyzeLicenses(
    context: AnalysisContext,
  ): Promise<(LicenseWasteFinding | LicenseOveruseFinding)[]> {
    const findings: (LicenseWasteFinding | LicenseOveruseFinding)[] = [];
    const identitiesToAnalyze = getIdentitiesToAnalyze(context, false);

    // 1. License Waste Detection
    for (const identity of identitiesToAnalyze) {
      const isDisabled = !identity.normalizedData.enabled;
      const isStale = this.isStaleUser(identity);
      const licenses = getLicensesForIdentity(context, identity._id);
      const hasLicenses = licenses.length > 0;

      if ((isDisabled || isStale) && hasLicenses) {
        const daysSinceLogin = this.getDaysSinceLogin(identity);

        findings.push({
          entityId: identity._id,
          alertType: "license_waste",
          severity: isDisabled ? "medium" : "low",
          message: isDisabled
            ? "License assigned to disabled user"
            : "License assigned to stale user (90+ days inactive)",
          metadata: {
            wastedLicenses: licenses.map((l) => ({
              licenseSkuId: l.externalId,
              licenseName: l.normalizedData.name || "",
            })),
            reason: isDisabled ? "disabled" : "stale",
            userEnabled: identity.normalizedData.enabled || false,
            userStale: isStale,
            daysSinceLogin,
          },
        });
      }
    }

    // 2. License Overuse Detection
    for (const license of context.licenses) {
      const consumed = license.normalizedData.consumedUnits || 0;
      const prepaidUnits = (license.rawData as any)?.prepaidUnits;
      const total = prepaidUnits?.enabled || 0;

      if (consumed > total) {
        findings.push({
          entityId: license._id,
          alertType: "license_overuse",
          severity: "high",
          message: `License overused: ${consumed} consumed vs ${total} available`,
          metadata: {
            licenseName: license.normalizedData.name || "",
            licenseSkuId: license.externalId,
            consumed,
            total,
            overage: consumed - total,
          },
        });
      }
    }

    return findings;
  }

  /**
   * Analyze stale users (90+ days inactive)
   */
  private async analyzeStaleUsers(
    context: AnalysisContext,
  ): Promise<StaleUserFinding[]> {
    const findings: StaleUserFinding[] = [];
    const enabledIdentities = getEnabledIdentities(context);

    for (const identity of enabledIdentities) {
      const isStale = this.isStaleUser(identity);
      const daysSinceLogin = this.getDaysSinceLogin(identity);

      if (isStale) {
        const identityIsAdmin = isAdmin(context, identity._id);
        const licenses = getLicensesForIdentity(context, identity._id);
        const hasLicenses = licenses.length > 0;

        let severity: "low" | "medium" | "high" = "medium";
        if (identityIsAdmin) severity = "high";
        else if (!hasLicenses) severity = "low";

        findings.push({
          entityId: identity._id,
          alertType: "stale_user",
          severity,
          message: identityIsAdmin
            ? `Admin user inactive for ${Math.floor(daysSinceLogin)} days`
            : `User inactive for ${Math.floor(daysSinceLogin)} days`,
          metadata: {
            isStale: true,
            daysSinceLogin: Math.floor(daysSinceLogin),
            hasLicenses,
            isEnabled: true,
            isAdmin: identityIsAdmin,
            lastLoginAt: identity.normalizedData.last_login_at || "",
          },
        });
      }
    }

    return findings;
  }

  /**
   * Check if a user is stale (90+ days since last login)
   */
  private isStaleUser(identity: any): boolean {
    const daysSinceLogin = this.getDaysSinceLogin(identity);
    return daysSinceLogin >= STALE_THRESHOLD_DAYS;
  }

  /**
   * Get days since last login
   */
  private getDaysSinceLogin(identity: any): number {
    const lastLoginAt = identity.normalizedData.last_login_at;
    if (!lastLoginAt) return Infinity;

    const lastLoginDate = new Date(lastLoginAt).getTime();
    return (Date.now() - lastLoginDate) / (24 * 60 * 60 * 1000);
  }

  /**
   * Emit unified findings to NATS
   */
  private async emitFindings(
    context: AnalysisContext,
    results: AnalysisResults,
    stats: any,
    syncId: string,
  ): Promise<void> {
    const event: UnifiedAnalysisEvent = {
      tenantId: context.tenantId,
      dataSourceId: context.dataSourceId,
      syncId,
      integrationType: context.integrationType,
      analysisTypes: ["mfa", "policy", "license", "stale"],
      findings: results,
      entityCounts: {
        identities: context.identities.length,
        groups: context.groups.length,
        roles: context.roles.length,
        policies: context.policies.length,
        licenses: context.licenses.length,
      },
      stats,
      createdAt: Date.now(),
    };

    await natsClient.publish("analysis.unified", event);

    Logger.log({
      module: "UnifiedAnalyzer",
      context: "emitFindings",
      message: "Published unified analysis event",
      metadata: {
        analysisTypes: event.analysisTypes,
        totalFindings: stats.totalFindings,
      },
    });
  }
}

export default UnifiedAnalyzer;
