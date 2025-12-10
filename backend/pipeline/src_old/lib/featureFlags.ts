/**
 * Feature Flags System - Phase 7
 *
 * Enables safe rollout of new pipeline functionality with:
 * - Environment-based global flags
 * - Per-tenant overrides
 * - Percentage-based gradual rollout
 * - Runtime flag checking
 *
 * Usage:
 *   const flags = FeatureFlagManager.getInstance();
 *   if (await flags.isEnabled('new_pipeline', tenantId)) {
 *     // Use new pipeline
 *   } else {
 *     // Use old pipeline
 *   }
 */

import type { Id } from "@workspace/database/convex/_generated/dataModel.js";
import Logger from "./logger.js";

export type FeatureFlagName =
  | "new_pipeline" // Master switch for entire new pipeline
  | "unified_analyzer" // Use unified analyzer instead of individual analyzers
  | "alert_manager" // Use new alert manager
  | "batch_loading" // Use optimized batch loading in linkers
  | "performance_monitoring" // Enable query performance tracking
  | "comparison_mode"; // Run both pipelines and compare results

export interface FeatureFlag {
  name: FeatureFlagName;
  description: string;
  enabled: boolean; // Global default
  rolloutPercentage?: number; // Percentage of tenants to enable (0-100)
  tenantOverrides?: Map<Id<"tenants">, boolean>; // Per-tenant overrides
}

export interface FeatureFlagStatus {
  name: FeatureFlagName;
  description: string;
  globalEnabled: boolean;
  rolloutPercentage: number;
  tenantOverrideCount: number;
  effectiveForTenant?: boolean; // Only set if tenantId provided
}

export class FeatureFlagManager {
  private static instance: FeatureFlagManager;
  private flags: Map<FeatureFlagName, FeatureFlag>;

  private constructor() {
    this.flags = new Map();
    this.initializeFlags();
  }

  public static getInstance(): FeatureFlagManager {
    if (!FeatureFlagManager.instance) {
      FeatureFlagManager.instance = new FeatureFlagManager();
    }
    return FeatureFlagManager.instance;
  }

  /**
   * Initialize feature flags from environment variables
   */
  private initializeFlags(): void {
    // Master switch for new pipeline
    this.flags.set("new_pipeline", {
      name: "new_pipeline",
      description: "Enable new pipeline architecture (Phases 1-7)",
      enabled: this.getEnvFlag("FEATURE_NEW_PIPELINE", true),
      rolloutPercentage: this.getEnvPercentage("FEATURE_NEW_PIPELINE_ROLLOUT", 100),
      tenantOverrides: new Map(),
    });

    // Unified analyzer
    this.flags.set("unified_analyzer", {
      name: "unified_analyzer",
      description: "Use unified analyzer (Phase 4)",
      enabled: this.getEnvFlag("FEATURE_UNIFIED_ANALYZER", true),
      rolloutPercentage: this.getEnvPercentage("FEATURE_UNIFIED_ANALYZER_ROLLOUT", 100),
      tenantOverrides: new Map(),
    });

    // Alert manager
    this.flags.set("alert_manager", {
      name: "alert_manager",
      description: "Use new alert manager (Phase 5)",
      enabled: this.getEnvFlag("FEATURE_ALERT_MANAGER", true),
      rolloutPercentage: this.getEnvPercentage("FEATURE_ALERT_MANAGER_ROLLOUT", 100),
      tenantOverrides: new Map(),
    });

    // Batch loading optimization
    this.flags.set("batch_loading", {
      name: "batch_loading",
      description: "Use optimized batch loading in linkers (Phase 6)",
      enabled: this.getEnvFlag("FEATURE_BATCH_LOADING", true),
      rolloutPercentage: this.getEnvPercentage("FEATURE_BATCH_LOADING_ROLLOUT", 100),
      tenantOverrides: new Map(),
    });

    // Performance monitoring
    this.flags.set("performance_monitoring", {
      name: "performance_monitoring",
      description: "Enable query performance monitoring (Phase 6)",
      enabled: this.getEnvFlag("FEATURE_PERFORMANCE_MONITORING", true),
      rolloutPercentage: this.getEnvPercentage("FEATURE_PERFORMANCE_MONITORING_ROLLOUT", 100),
      tenantOverrides: new Map(),
    });

    // Comparison mode
    this.flags.set("comparison_mode", {
      name: "comparison_mode",
      description: "Run both old and new pipelines and compare results (Phase 7)",
      enabled: this.getEnvFlag("FEATURE_COMPARISON_MODE", false),
      rolloutPercentage: this.getEnvPercentage("FEATURE_COMPARISON_MODE_ROLLOUT", 0),
      tenantOverrides: new Map(),
    });

    Logger.log({
      module: "FeatureFlagManager",
      context: "initialize",
      message: `Initialized ${this.flags.size} feature flags`,
      metadata: {
        flags: Array.from(this.flags.values()).map((f) => ({
          name: f.name,
          enabled: f.enabled,
          rollout: f.rolloutPercentage,
        })),
      },
    });
  }

  /**
   * Get boolean flag from environment
   */
  private getEnvFlag(key: string, defaultValue: boolean): boolean {
    const value = process.env[key];
    if (value === undefined) return defaultValue;
    return value === "true" || value === "1";
  }

  /**
   * Get percentage from environment (0-100)
   */
  private getEnvPercentage(key: string, defaultValue: number): number {
    const value = process.env[key];
    if (value === undefined) return defaultValue;
    const percentage = parseInt(value, 10);
    if (isNaN(percentage) || percentage < 0 || percentage > 100) {
      Logger.log({
        module: "FeatureFlagManager",
        context: "getEnvPercentage",
        message: `Invalid percentage for ${key}: ${value}, using ${defaultValue}`,
        level: "warn",
      });
      return defaultValue;
    }
    return percentage;
  }

  /**
   * Check if a feature flag is enabled for a tenant
   */
  public async isEnabled(
    flagName: FeatureFlagName,
    tenantId?: Id<"tenants">
  ): Promise<boolean> {
    const flag = this.flags.get(flagName);
    if (!flag) {
      Logger.log({
        module: "FeatureFlagManager",
        context: "isEnabled",
        message: `Unknown flag: ${flagName}`,
        level: "warn",
      });
      return false;
    }

    // Check tenant override first
    if (tenantId && flag.tenantOverrides?.has(tenantId)) {
      const override = flag.tenantOverrides.get(tenantId)!;
      Logger.log({
        module: "FeatureFlagManager",
        context: "isEnabled",
        message: `Flag ${flagName} for tenant ${tenantId}: ${override} (override)`,
      });
      return override;
    }

    // Check global flag
    if (!flag.enabled) {
      return false;
    }

    // Check rollout percentage
    if (flag.rolloutPercentage !== undefined && flag.rolloutPercentage < 100 && tenantId) {
      const isInRollout = this.isInRolloutPercentage(tenantId, flag.rolloutPercentage);
      Logger.log({
        module: "FeatureFlagManager",
        context: "isEnabled",
        message: `Flag ${flagName} for tenant ${tenantId}: ${isInRollout} (${flag.rolloutPercentage}% rollout)`,
      });
      return isInRollout;
    }

    return flag.enabled;
  }

  /**
   * Determine if tenant is in rollout percentage using consistent hashing
   */
  private isInRolloutPercentage(tenantId: Id<"tenants">, percentage: number): boolean {
    if (percentage === 0) return false;
    if (percentage === 100) return true;

    // Use simple hash of tenant ID to deterministically assign to percentage bucket
    let hash = 0;
    for (let i = 0; i < tenantId.length; i++) {
      hash = (hash << 5) - hash + tenantId.charCodeAt(i);
      hash |= 0; // Convert to 32-bit integer
    }

    // Map hash to 0-99 range
    const bucket = Math.abs(hash) % 100;
    return bucket < percentage;
  }

  /**
   * Set a tenant-specific override
   */
  public setTenantOverride(
    flagName: FeatureFlagName,
    tenantId: Id<"tenants">,
    enabled: boolean
  ): void {
    const flag = this.flags.get(flagName);
    if (!flag) {
      throw new Error(`Unknown flag: ${flagName}`);
    }

    if (!flag.tenantOverrides) {
      flag.tenantOverrides = new Map();
    }

    flag.tenantOverrides.set(tenantId, enabled);

    Logger.log({
      module: "FeatureFlagManager",
      context: "setTenantOverride",
      message: `Set tenant override for ${flagName}`,
      metadata: { tenantId, enabled },
    });
  }

  /**
   * Remove a tenant-specific override
   */
  public removeTenantOverride(flagName: FeatureFlagName, tenantId: Id<"tenants">): void {
    const flag = this.flags.get(flagName);
    if (!flag || !flag.tenantOverrides) {
      return;
    }

    flag.tenantOverrides.delete(tenantId);

    Logger.log({
      module: "FeatureFlagManager",
      context: "removeTenantOverride",
      message: `Removed tenant override for ${flagName}`,
      metadata: { tenantId },
    });
  }

  /**
   * Update global flag setting
   */
  public setGlobalFlag(flagName: FeatureFlagName, enabled: boolean): void {
    const flag = this.flags.get(flagName);
    if (!flag) {
      throw new Error(`Unknown flag: ${flagName}`);
    }

    flag.enabled = enabled;

    Logger.log({
      module: "FeatureFlagManager",
      context: "setGlobalFlag",
      message: `Set global flag ${flagName} to ${enabled}`,
    });
  }

  /**
   * Update rollout percentage
   */
  public setRolloutPercentage(flagName: FeatureFlagName, percentage: number): void {
    if (percentage < 0 || percentage > 100) {
      throw new Error(`Invalid percentage: ${percentage} (must be 0-100)`);
    }

    const flag = this.flags.get(flagName);
    if (!flag) {
      throw new Error(`Unknown flag: ${flagName}`);
    }

    flag.rolloutPercentage = percentage;

    Logger.log({
      module: "FeatureFlagManager",
      context: "setRolloutPercentage",
      message: `Set rollout percentage for ${flagName} to ${percentage}%`,
    });
  }

  /**
   * Get status of a feature flag
   */
  public getStatus(flagName: FeatureFlagName, tenantId?: Id<"tenants">): FeatureFlagStatus {
    const flag = this.flags.get(flagName);
    if (!flag) {
      throw new Error(`Unknown flag: ${flagName}`);
    }

    const status: FeatureFlagStatus = {
      name: flag.name,
      description: flag.description,
      globalEnabled: flag.enabled,
      rolloutPercentage: flag.rolloutPercentage ?? 100,
      tenantOverrideCount: flag.tenantOverrides?.size ?? 0,
    };

    if (tenantId) {
      // Calculate effective value for this tenant
      if (flag.tenantOverrides?.has(tenantId)) {
        status.effectiveForTenant = flag.tenantOverrides.get(tenantId)!;
      } else if (!flag.enabled) {
        status.effectiveForTenant = false;
      } else if (flag.rolloutPercentage !== undefined && flag.rolloutPercentage < 100) {
        status.effectiveForTenant = this.isInRolloutPercentage(tenantId, flag.rolloutPercentage);
      } else {
        status.effectiveForTenant = flag.enabled;
      }
    }

    return status;
  }

  /**
   * Get all feature flag statuses
   */
  public getAllStatuses(tenantId?: Id<"tenants">): FeatureFlagStatus[] {
    return Array.from(this.flags.keys()).map((flagName) => this.getStatus(flagName, tenantId));
  }

  /**
   * Reset all flags to default values from environment
   */
  public reset(): void {
    this.flags.clear();
    this.initializeFlags();

    Logger.log({
      module: "FeatureFlagManager",
      context: "reset",
      message: "Reset all feature flags to defaults",
    });
  }
}

export default FeatureFlagManager;
