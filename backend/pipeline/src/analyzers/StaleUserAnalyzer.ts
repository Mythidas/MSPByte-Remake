import { BaseAnalyzer } from "./BaseAnalyzer.js";
import { AnalysisContext, AnalyzerResult } from "../types.js";
import { Logger } from "../lib/logger.js";
import { M365NormalIdentity } from "@workspace/shared/types/integrations/microsoft-365/identities.js";
import { isAdminUser } from "./helpers/M365Helper.js";

/**
 * StaleUserAnalyzer - Detects identities with logins older than 90 days
 */
export class StaleUserAnalyzer extends BaseAnalyzer {
	getName(): string {
		return "StaleUserAnalyzer";
	}

	async analyze(context: AnalysisContext): Promise<AnalyzerResult> {
		Logger.log({
			module: "StaleUserAnalyzer",
			context: "analyze",
			message: `Analyzing MFA enforcement for ${context.integrationId}`,
			level: "info",
		});

		const result = this.createEmptyResult();

		// Only analyze Microsoft 365 for now
		if (context.integrationId !== "microsoft-365") {
			Logger.log({
				module: "StaleUserAnalyzer",
				context: "analyze",
				message: `Skipping MFA analysis for ${context.integrationId} (not supported)`,
				level: "trace",
			});
			return result;
		}

		for (const identity of context.entities.identities) {
			const data = identity.rawData as M365NormalIdentity;
			const lastLogin = new Date(
				data.signInActivity?.lastSignInDateTime ||
					data.signInActivity?.lastNonInteractiveSignInDateTime ||
					0,
			).getTime();

			if (lastLogin <= Date.now() - 1000 * 60 * 60 * 24 * 91) {
				const isAdmin = isAdminUser(identity, context);
				const hasLicense = (data.assignedLicenses?.length || 0) > 0;
				const alert = this.createAlert(
					identity._id,
					"stale-user",
					isAdmin ? "critical" : hasLicense ? "high" : "low",
					`User '${data.displayName}' last logged in ${lastLogin / (1000 * 60 * 60 * 24)} days ago`,
					{
						userPrincipalName: identity.rawData.userPrincipalName,
						isAdmin,
						hasLicense,
						lastLogin:
							lastLogin > 0 ? new Date(lastLogin).toISOString() : "Never",
					},
				);

				result.alerts.push(alert);
				this.setState(
					result,
					identity._id,
					isAdmin ? "critical" : hasLicense ? "warn" : "low",
				);
				this.addTags(result, identity._id, ["Stale"]);
			} else {
				this.setState(result, identity._id, "normal");
				this.addTags(result, identity._id, []);
			}
		}

		Logger.log({
			module: "StaleUserAnalyzer",
			context: "analyze",
			message: `Analysis complete: ${result.alerts.length} alerts, ${result.entityTags.size} tagged entities, ${result.entityStates.size} state changes`,
			level: "info",
		});

		return result;
	}
}
