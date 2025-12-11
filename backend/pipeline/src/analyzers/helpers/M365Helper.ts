import {
	AnalysisContext,
	Entity,
	MFACoverage,
} from "@workspace/pipeline/types.js";
import { MSGraphConditionalAccessPolicy } from "@workspace/shared/types/integrations/microsoft-365/policies.js";

/**
 * Check if Security Defaults are enabled
 * Security Defaults provide baseline MFA enforcement for all users
 */
export function checkSecurityDefaults(context: AnalysisContext): boolean {
	const securityDefaultsPolicy = context.entities.policies.find(
		(p) => p.externalId === "security-defaults",
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
export function getMFAPolicies(context: AnalysisContext): Entity[] {
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
 * Check MFA coverage level for an identity
 * Returns coverage level (none/partial/full) and reason for partial coverage
 */
export function checkIdentityMFACoverage(
	identity: Entity,
	context: AnalysisContext,
	mfaPolicies: Entity[],
	securityDefaultsEnabled: boolean,
): { coverage: MFACoverage; reason?: string } {
	const isAdmin = isAdminUser(identity, context);

	// Security Defaults - only fully protect admins
	if (securityDefaultsEnabled) {
		if (isAdmin) {
			return { coverage: "full" };
		} else {
			return {
				coverage: "partial",
				reason:
					"Security Defaults only enforce MFA for administrator accounts, not regular users",
			};
		}
	}

	// Check Conditional Access policies
	let hasFullCoverage = false;
	let hasPartialCoverage = false;
	let partialReason = "";

	for (const policy of mfaPolicies) {
		const appliestoUser = doesPolicyApplyToUser(policy, identity, context);
		if (!appliestoUser) {
			continue;
		}

		// Check if policy covers ALL applications
		const rawData = policy.rawData as MSGraphConditionalAccessPolicy;
		const apps = rawData.conditions?.applications;
		const includeApps = apps?.includeApplications || [];
		const coversAllApps = includeApps.includes("All");

		if (coversAllApps) {
			hasFullCoverage = true;
			break; // Found full coverage, no need to check more policies
		} else {
			hasPartialCoverage = true;
			const appCount = includeApps.length;
			partialReason = `MFA policy only covers ${appCount} specific application${appCount !== 1 ? "s" : ""}, not all applications`;
		}
	}

	if (hasFullCoverage) {
		return { coverage: "full" };
	} else if (hasPartialCoverage) {
		return { coverage: "partial", reason: partialReason };
	} else {
		return { coverage: "none" };
	}
}

/**
 * Check if a conditional access policy applies to a specific user
 */
export function doesPolicyApplyToUser(
	policy: Entity,
	identity: Entity,
	context: AnalysisContext,
): boolean {
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
	if (isUserInAnyGroup(identity, excludeGroups, context)) {
		return false;
	}

	// Check inclusions
	if (includeUsers.includes(userId) || includeUsers.includes("All")) {
		return true;
	}

	// Check if user is in included groups
	if (isUserInAnyGroup(identity, includeGroups, context)) {
		return true;
	}

	return false;
}

/**
 * Check if a user is a member of any of the specified groups
 */
export function isUserInAnyGroup(
	identity: Entity,
	groupIds: string[],
	context: AnalysisContext,
): boolean {
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
export function isAdminUser(
	identity: Entity,
	context: AnalysisContext,
): boolean {
	const roleAssignments = context.getRelationships(
		identity._id,
		"role-assignment",
	);

	for (const assignment of roleAssignments) {
		const role = context.getEntity(assignment.parentEntityId);
		if (role && isAdminRole(role)) {
			return true;
		}
	}

	return false;
}

/**
 * Check if a role is an admin role
 */
export function isAdminRole(role: Entity): boolean {
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
	return adminRoleNames.some(
		(adminRole) =>
			displayName.includes(adminRole) || displayName.includes("Admin"),
	);
}

/**
 * Get display name for identity
 */
export function getDisplayName(identity: Entity): string {
	return (
		identity.rawData?.displayName ||
		identity.rawData?.userPrincipalName ||
		identity.externalId
	);
}
