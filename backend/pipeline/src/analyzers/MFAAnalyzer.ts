import { BaseAnalyzer } from "./BaseAnalyzer.js";
import { AnalysisContext, AnalyzerResult } from "../types.js";
import { Logger } from "../lib/logger.js";
import {
	checkSecurityDefaults,
	getMFAPolicies,
	checkIdentityMFACoverage,
	isAdminUser,
	getDisplayName,
} from "./helpers/M365Helper.js";

/**
 * MFAAnalyzer - Detects identities without MFA enforcement
 *
 * For Microsoft 365:
 * - Checks conditional access policies for MFA requirements
 * - Checks security defaults (protects admins only)
 * - Distinguishes between no MFA, partial MFA, and full MFA
 *
 * Coverage Levels:
 * - None: No MFA enforcement at all
 * - Partial: MFA enforced but not comprehensive (security defaults for non-admins, or CA policies covering some apps only)
 * - Full: Complete MFA coverage (security defaults for admins, or CA policies covering all apps)
 *
 * Alerts:
 * - Type: "mfa-not-enforced" (severity: "critical")
 * - Type: "mfa-partial-enforced" (severity: "high")
 *
 * Tags:
 * - "MFA None", "MFA Partial", or "MFA Full"
 *
 * States:
 * - "critical" for identities with no MFA
 * - "high" for identities with partial MFA
 * - "normal" for identities with full MFA
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
		const securityDefaultsEnabled = checkSecurityDefaults(context);

		// Get conditional access policies that enforce MFA
		const mfaPolicies = getMFAPolicies(context);

		Logger.log({
			module: "MFAAnalyzer",
			context: "analyze",
			message: `Found ${mfaPolicies.length} MFA policies, Security Defaults: ${securityDefaultsEnabled}`,
			level: "trace",
		});

		// Analyze each identity
		for (const identity of context.entities.identities) {
			const { coverage, reason } = checkIdentityMFACoverage(
				identity,
				context,
				mfaPolicies,
				securityDefaultsEnabled,
			);

			const isAdmin = isAdminUser(identity, context);
			const displayName = getDisplayName(identity);

			if (coverage === "none") {
				// No MFA coverage - create critical alert
				const alert = this.createAlert(
					identity._id,
					"mfa-not-enforced",
					"critical",
					isAdmin
						? `Admin user '${displayName}' does not have MFA enforced`
						: `User '${displayName}' does not have MFA enforced`,
					{
						userPrincipalName: identity.rawData.userPrincipalName,
						isAdmin,
						securityDefaultsEnabled,
						mfaPoliciesCount: mfaPolicies.length,
						coverage,
					},
				);
				result.alerts.push(alert);
				this.addTags(result, identity._id, ["MFA None"]);
				this.setState(result, identity._id, "critical");
			} else if (coverage === "partial") {
				// Partial MFA coverage - create high severity alert
				const alert = this.createAlert(
					identity._id,
					"mfa-partial-enforced",
					"high",
					isAdmin
						? `Admin user '${displayName}' has partial MFA coverage`
						: `User '${displayName}' has partial MFA coverage`,
					{
						userPrincipalName: identity.rawData.userPrincipalName,
						isAdmin,
						securityDefaultsEnabled,
						mfaPoliciesCount: mfaPolicies.length,
						coverage,
						reason,
					},
				);
				result.alerts.push(alert);
				this.addTags(result, identity._id, ["MFA Partial"]);
				this.setState(result, identity._id, "warn");
			} else {
				// Full MFA coverage - reset state to normal
				this.setState(result, identity._id, "normal");
				this.addTags(result, identity._id, []);
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
}
