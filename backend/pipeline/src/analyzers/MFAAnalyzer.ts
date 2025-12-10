import { BaseAnalyzer } from "./BaseAnalyzer.js";
import { AnalysisContext, AnalyzerResult, Entity } from "../types.js";
import { Logger } from "../lib/logger.js";
import { MSGraphConditionalAccessPolicy } from "@workspace/shared/types/integrations/microsoft-365/policies.js";

/**
 * MFAAnalyzer - Detects identities without MFA enforcement
 *
 * For Microsoft 365:
 * - Checks conditional access policies for MFA requirements
 * - Checks security defaults (legacy MFA enforcement)
 * - Flags identities not covered by any MFA policy
 *
 * Alerts:
 * - Type: "mfa-not-enforced"
 * - Severity: "high" (critical for admin accounts)
 *
 * Tags:
 * - "mfa-enabled" or "mfa-disabled"
 * - "security-defaults-enabled" (if security defaults are on)
 *
 * States:
 * - "high" for identities without MFA
 * - "critical" for admin identities without MFA
 */
export class MFAAnalyzer extends BaseAnalyzer {
    getName(): string {
        return "MFAAnalyzer";
    }

    async analyze(context: AnalysisContext): Promise<AnalyzerResult> {
        Logger.log({
            module: "MFAAnalyzer",
            context: "analyze",
            message: `Analyzing MFA enforcement for ${context.integrationId}`,
            level: "info",
        });

        const result = this.createEmptyResult();

        // Only analyze Microsoft 365 for now
        if (context.integrationId !== "microsoft-365") {
            Logger.log({
                module: "MFAAnalyzer",
                context: "analyze",
                message: `Skipping MFA analysis for ${context.integrationId} (not supported)`,
                level: "trace",
            });
            return result;
        }

        // Check if Security Defaults are enabled (legacy MFA enforcement)
        const securityDefaultsEnabled = this.checkSecurityDefaults(context);

        // Get conditional access policies that enforce MFA
        const mfaPolicies = this.getMFAPolicies(context);

        Logger.log({
            module: "MFAAnalyzer",
            context: "analyze",
            message: `Found ${mfaPolicies.length} MFA policies, Security Defaults: ${securityDefaultsEnabled}`,
            level: "trace",
        });

        // Analyze each identity
        for (const identity of context.entities.identities) {
            const hasMFA = this.checkIdentityMFA(identity, context, mfaPolicies, securityDefaultsEnabled);

            if (hasMFA) {
                // Identity has MFA - tag as enabled
                this.addTags(result, identity._id, ["mfa-enabled"]);
                if (securityDefaultsEnabled) {
                    this.addTags(result, identity._id, ["security-defaults-enabled"]);
                }
            } else {
                // Identity missing MFA - create alert
                const isAdmin = this.isAdminUser(identity, context);
                const severity = isAdmin ? "critical" : "high";

                const alert = this.createAlert(
                    identity._id,
                    "mfa-not-enforced",
                    severity,
                    isAdmin
                        ? `Admin user '${this.getDisplayName(identity)}' does not have MFA enforced`
                        : `User '${this.getDisplayName(identity)}' does not have MFA enforced`,
                    {
                        userPrincipalName: identity.rawData.userPrincipalName,
                        isAdmin,
                        securityDefaultsEnabled,
                        mfaPoliciesCount: mfaPolicies.length,
                    }
                );
                result.alerts.push(alert);

                this.addTags(result, identity._id, ["mfa-disabled"]);
                this.setState(result, identity._id, severity === "critical" ? "critical" : "high");
            }
        }

        Logger.log({
            module: "MFAAnalyzer",
            context: "analyze",
            message: `Analysis complete: ${result.alerts.length} alerts, ${result.entityTags.size} tagged entities, ${result.entityStates.size} state changes`,
            level: "info",
        });

        return result;
    }

    /**
     * Check if Security Defaults are enabled
     * Security Defaults provide baseline MFA enforcement for all users
     */
    private checkSecurityDefaults(context: AnalysisContext): boolean {
        const securityDefaultsPolicy = context.entities.policies.find(
            (p) => p.externalId === "security-defaults"
        );

        if (!securityDefaultsPolicy) {
            return false;
        }

        // Security defaults entity has isEnabled field
        return securityDefaultsPolicy.rawData?.isEnabled === true;
    }

    /**
     * Get all conditional access policies that enforce MFA
     */
    private getMFAPolicies(context: AnalysisContext): Entity[] {
        return context.entities.policies.filter((policy) => {
            // Skip security defaults pseudo-policy
            if (policy.externalId === "security-defaults") {
                return false;
            }

            const rawData = policy.rawData as MSGraphConditionalAccessPolicy;

            // Policy must be enabled
            if (rawData?.state !== "enabled") {
                return false;
            }

            // Policy must require MFA (grantControls.builtInControls includes "mfa")
            const grantControls = rawData?.grantControls?.builtInControls || [];
            return grantControls.includes("mfa");
        });
    }

    /**
     * Check if an identity has MFA enforced
     */
    private checkIdentityMFA(
        identity: Entity,
        context: AnalysisContext,
        mfaPolicies: Entity[],
        securityDefaultsEnabled: boolean
    ): boolean {
        // If security defaults are enabled, ALL users have MFA
        if (securityDefaultsEnabled) {
            return true;
        }

        // Check if user is covered by any MFA policy
        for (const policy of mfaPolicies) {
            if (this.doesPolicyApplyToUser(policy, identity, context)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Check if a conditional access policy applies to a specific user
     */
    private doesPolicyApplyToUser(policy: Entity, identity: Entity, context: AnalysisContext): boolean {
        const rawData = policy.rawData as MSGraphConditionalAccessPolicy;
        const conditions = rawData?.conditions;
        if (!conditions) {
            return false;
        }

        // Check user/group inclusions and exclusions
        const users = conditions.users;
        const includeUsers = users?.includeUsers || [];
        const excludeUsers = users?.excludeUsers || [];
        const includeGroups = users?.includeGroups || [];
        const excludeGroups = users?.excludeGroups || [];

        const userId = identity.externalId;

        // Check explicit exclusions first
        if (excludeUsers.includes(userId) || excludeUsers.includes("All")) {
            return false;
        }

        // Check if user is in excluded groups
        if (this.isUserInAnyGroup(identity, excludeGroups, context)) {
            return false;
        }

        // Check inclusions
        if (includeUsers.includes(userId) || includeUsers.includes("All")) {
            return true;
        }

        // Check if user is in included groups
        if (this.isUserInAnyGroup(identity, includeGroups, context)) {
            return true;
        }

        return false;
    }

    /**
     * Check if a user is a member of any of the specified groups
     */
    private isUserInAnyGroup(identity: Entity, groupIds: string[], context: AnalysisContext): boolean {
        // Get all group memberships for this identity
        const memberships = context.getRelationships(identity._id, "group-member");

        for (const membership of memberships) {
            const group = context.getEntity(membership.parentEntityId);
            if (group && groupIds.includes(group.externalId)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Check if a user has admin role assignments
     */
    private isAdminUser(identity: Entity, context: AnalysisContext): boolean {
        const roleAssignments = context.getRelationships(identity._id, "role-assignment");

        for (const assignment of roleAssignments) {
            const role = context.getEntity(assignment.parentEntityId);
            if (role && this.isAdminRole(role)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Check if a role is an admin role
     */
    private isAdminRole(role: Entity): boolean {
        const adminRoleNames = [
            "Global Administrator",
            "Privileged Role Administrator",
            "Security Administrator",
            "Compliance Administrator",
            "Exchange Administrator",
            "SharePoint Administrator",
            "User Administrator",
        ];

        const displayName = role.rawData?.displayName || "";
        return adminRoleNames.some((adminRole) => displayName.includes(adminRole) || displayName.includes("Admin"));
    }

    /**
     * Get display name for identity
     */
    private getDisplayName(identity: Entity): string {
        return (
            identity.rawData?.displayName ||
            identity.rawData?.userPrincipalName ||
            identity.externalId
        );
    }
}
