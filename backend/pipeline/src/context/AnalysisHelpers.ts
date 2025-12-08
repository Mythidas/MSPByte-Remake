/**
 * AnalysisHelpers - Utility functions for working with AnalysisContext
 *
 * These helper functions provide O(1) lookups using the pre-computed maps
 * in AnalysisContext, eliminating the need for N+1 database queries.
 *
 * Usage:
 *   const groups = getGroupsForIdentity(context, identityId);
 *   const hasM FA = isInGroup(context, identityId, mfaGroupId);
 */

import type { Doc, Id } from "@workspace/database/convex/_generated/dataModel.js";
import type { AnalysisContext } from "./AnalysisContext.js";

/**
 * Get all groups an identity belongs to (O(1) lookup)
 */
export function getGroupsForIdentity(
  context: AnalysisContext,
  identityId: Id<"entities">
): Doc<"entities">[] {
  const groupIds = context.relationshipMaps.identityToGroups.get(identityId) || [];
  return groupIds
    .map((id) => context.entityMaps.groupsById.get(id))
    .filter((g): g is Doc<"entities"> => g !== undefined);
}

/**
 * Check if an identity is in a specific group (O(1) lookup)
 */
export function isInGroup(
  context: AnalysisContext,
  identityId: Id<"entities">,
  groupId: Id<"entities">
): boolean {
  const groupIds = context.relationshipMaps.identityToGroups.get(identityId) || [];
  return groupIds.includes(groupId);
}

/**
 * Get all roles assigned to an identity (O(1) lookup)
 */
export function getRolesForIdentity(
  context: AnalysisContext,
  identityId: Id<"entities">
): Doc<"entities">[] {
  const roleIds = context.relationshipMaps.identityToRoles.get(identityId) || [];
  return roleIds
    .map((id) => context.entityMaps.rolesById.get(id))
    .filter((r): r is Doc<"entities"> => r !== undefined);
}

/**
 * Check if an identity has a specific role (O(1) lookup)
 */
export function hasRole(
  context: AnalysisContext,
  identityId: Id<"entities">,
  roleId: Id<"entities">
): boolean {
  const roleIds = context.relationshipMaps.identityToRoles.get(identityId) || [];
  return roleIds.includes(roleId);
}

/**
 * Check if an identity has any admin role (O(1) after initial filter)
 */
export function isAdmin(
  context: AnalysisContext,
  identityId: Id<"entities">
): boolean {
  const roles = getRolesForIdentity(context, identityId);
  return roles.some((role) => {
    const roleName = role.normalizedData.name?.toLowerCase() || "";
    return roleName.includes("administrator") || roleName.includes("admin");
  });
}

/**
 * Get all licenses assigned to an identity (O(1) lookup)
 */
export function getLicensesForIdentity(
  context: AnalysisContext,
  identityId: Id<"entities">
): Doc<"entities">[] {
  const licenseIds = context.relationshipMaps.identityToLicenses.get(identityId) || [];
  return licenseIds
    .map((id) => context.entityMaps.licensesById.get(id))
    .filter((l): l is Doc<"entities"> => l !== undefined);
}

/**
 * Check if an identity has a specific license (O(1) lookup)
 */
export function hasLicense(
  context: AnalysisContext,
  identityId: Id<"entities">,
  licenseId: Id<"entities">
): boolean {
  const licenseIds = context.relationshipMaps.identityToLicenses.get(identityId) || [];
  return licenseIds.includes(licenseId);
}

/**
 * Get all policies that apply to an identity (O(1) lookup + group expansion)
 */
export function getPoliciesForIdentity(
  context: AnalysisContext,
  identityId: Id<"entities">
): Doc<"entities">[] {
  const policyIds = new Set<Id<"entities">>();

  // Direct policies
  const directPolicyIds = context.relationshipMaps.identityToPolicies.get(identityId) || [];
  directPolicyIds.forEach((id) => policyIds.add(id));

  // Policies via groups
  const groupIds = context.relationshipMaps.identityToGroups.get(identityId) || [];
  for (const groupId of groupIds) {
    // Find policies that target this group
    for (const [policyId, targets] of context.relationshipMaps.policyToTargets.entries()) {
      if (targets.includes(groupId)) {
        policyIds.add(policyId);
      }
    }
  }

  return Array.from(policyIds)
    .map((id) => context.entityMaps.policiesById.get(id))
    .filter((p): p is Doc<"entities"> => p !== undefined);
}

/**
 * Check if a policy applies to an identity (O(1) lookup + group expansion)
 */
export function doesPolicyApply(
  context: AnalysisContext,
  policyId: Id<"entities">,
  identityId: Id<"entities">
): boolean {
  const targets = context.relationshipMaps.policyToTargets.get(policyId) || [];

  // Check direct application
  if (targets.includes(identityId)) {
    return true;
  }

  // Check via group membership
  const groupIds = context.relationshipMaps.identityToGroups.get(identityId) || [];
  return groupIds.some((groupId) => targets.includes(groupId));
}

/**
 * Get all members of a group (O(1) lookup)
 */
export function getGroupMembers(
  context: AnalysisContext,
  groupId: Id<"entities">
): Doc<"entities">[] {
  const memberIds = context.relationshipMaps.groupToMembers.get(groupId) || [];
  return memberIds
    .map((id) => context.entityMaps.identitiesById.get(id))
    .filter((i): i is Doc<"entities"> => i !== undefined);
}

/**
 * Get all identities assigned a specific role (O(1) lookup)
 */
export function getRoleAssignees(
  context: AnalysisContext,
  roleId: Id<"entities">
): Doc<"entities">[] {
  const assigneeIds = context.relationshipMaps.roleToAssignees.get(roleId) || [];
  return assigneeIds
    .map((id) => context.entityMaps.identitiesById.get(id))
    .filter((i): i is Doc<"entities"> => i !== undefined);
}

/**
 * Get all identities that have a specific license (O(1) lookup)
 */
export function getLicenseHolders(
  context: AnalysisContext,
  licenseId: Id<"entities">
): Doc<"entities">[] {
  const holderIds = context.relationshipMaps.licenseToHolders.get(licenseId) || [];
  return holderIds
    .map((id) => context.entityMaps.identitiesById.get(id))
    .filter((i): i is Doc<"entities"> => i !== undefined);
}

/**
 * Get identities to analyze (either changed only, or all)
 */
export function getIdentitiesToAnalyze(
  context: AnalysisContext,
  analyzeOnlyChanged: boolean = true
): Doc<"entities">[] {
  if (!analyzeOnlyChanged || !context.changedEntityIds || context.changedEntityIds.length === 0) {
    // Analyze all identities
    return context.identities;
  }

  // Analyze only changed identities
  const changedIdSet = new Set(context.changedEntityIds);
  return context.identities.filter((identity) => changedIdSet.has(identity._id));
}

/**
 * Get entity by external ID (O(1) lookup)
 */
export function getEntityByExternalId(
  context: AnalysisContext,
  externalId: string
): Doc<"entities"> | undefined {
  return context.entityMaps.entitiesByExternalId.get(externalId);
}

/**
 * Get entity by internal ID (O(1) lookup)
 */
export function getEntityById(
  context: AnalysisContext,
  entityId: Id<"entities">
): Doc<"entities"> | undefined {
  return context.entityMaps.entitiesById.get(entityId);
}

/**
 * Check if an identity is enabled/active
 */
export function isIdentityEnabled(identity: Doc<"entities">): boolean {
  return identity.normalizedData.enabled === true;
}

/**
 * Check if an identity is a guest user
 */
export function isGuestUser(identity: Doc<"entities">): boolean {
  const userType = identity.normalizedData.type?.toLowerCase() || "";
  return userType === "guest";
}

/**
 * Get all enabled identities from context
 */
export function getEnabledIdentities(context: AnalysisContext): Doc<"entities">[] {
  return context.identities.filter(isIdentityEnabled);
}

/**
 * Get companies for multi-entity analysis
 */
export function getCompanyEndpoints(
  context: AnalysisContext,
  companyId: Id<"entities">
): Doc<"entities">[] {
  const endpointIds = context.relationshipMaps.companyToEndpoints.get(companyId) || [];
  return endpointIds
    .map((id) => context.entityMaps.endpointsById.get(id))
    .filter((e): e is Doc<"entities"> => e !== undefined);
}

/**
 * Get firewalls for a company
 */
export function getCompanyFirewalls(
  context: AnalysisContext,
  companyId: Id<"entities">
): Doc<"entities">[] {
  const firewallIds = context.relationshipMaps.companyToFirewalls.get(companyId) || [];
  return firewallIds
    .map((id) => context.entityMaps.firewallsById.get(id))
    .filter((f): f is Doc<"entities"> => f !== undefined);
}

/**
 * Check if an identity has MFA enabled (for Microsoft 365)
 */
export function hasMFAEnabled(identity: Doc<"entities">): boolean {
  const tags = identity.normalizedData.tags || [];
  return tags.includes("MFA");
}

/**
 * Check if a license is a "bloat" license (free/trial)
 */
export function isBloatLicense(license: Doc<"entities">): boolean {
  const tags = license.normalizedData.tags || [];
  return tags.includes("bloat");
}
