import { BaseLinker } from "./BaseLinker.js";
import { RelationshipToCreate, Entity } from "../types.js";
import { Logger } from "../lib/logger.js";
import type { Id } from "@workspace/database/convex/_generated/dataModel";

/**
 * Microsoft365Linker - Creates relationships between M365 entities
 *
 * Relationships created:
 * 1. Group Memberships: identity → group (type: "group-member")
 * 2. Role Assignments: identity → role (type: "role-assignment")
 * 3. License Assignments: identity → license (type: "license-assignment")
 * 4. Nested Groups: group → parent group (type: "group-member")
 *
 * Data sources:
 * - Group members: stored in group entity's rawData.members array
 * - Role members: stored in role entity's rawData.members array
 * - License assignments: stored in identity's rawData.assignedLicenses array
 * - Group memberships: stored in group's rawData.memberOf array (nested groups)
 */
export class Microsoft365Linker extends BaseLinker {
  constructor(convexUrl: string) {
    super(convexUrl, "microsoft-365");
  }

  protected getLinkerName(): string {
    return "Microsoft365Linker";
  }

  /**
   * Determine all relationships for Microsoft 365 entities
   */
  protected async link(
    entities: Entity[],
    _dataSourceId: Id<"data_sources">,
  ): Promise<RelationshipToCreate[]> {
    Logger.log({
      module: "Microsoft365Linker",
      context: "link",
      message: `Linking ${entities.length} entities`,
      level: "info",
    });

    const relationships: RelationshipToCreate[] = [];

    // Build lookup maps for O(1) access
    const entityMap = new Map(entities.map((e) => [e.externalId, e]));
    const entitiesByType = this.groupEntitiesByType(entities);

    // 1. Link group memberships (identities → groups)
    relationships.push(
      ...this.linkGroupMemberships(entitiesByType.groups, entityMap),
    );

    // 2. Link role assignments (identities → roles)
    relationships.push(
      ...this.linkRoleAssignments(entitiesByType.roles, entityMap),
    );

    // 3. Link license assignments (identities → licenses)
    relationships.push(
      ...this.linkLicenseAssignments(entitiesByType.identities, entityMap),
    );

    // 4. Link nested groups (groups → parent groups)
    relationships.push(
      ...this.linkNestedGroups(entitiesByType.groups, entityMap),
    );

    Logger.log({
      module: "Microsoft365Linker",
      context: "link",
      message: `Created ${relationships.length} relationships`,
      level: "info",
    });

    return relationships;
  }

  /**
   * Group entities by type for easier processing
   */
  private groupEntitiesByType(entities: Entity[]): Record<string, Entity[]> {
    const grouped: Record<string, Entity[]> = {
      identities: [],
      groups: [],
      roles: [],
      licenses: [],
      policies: [],
      companies: [],
      endpoints: [],
      firewalls: [],
    };

    for (const entity of entities) {
      if (entity.entityType && grouped[entity.entityType]) {
        grouped[entity.entityType].push(entity);
      }
    }

    return grouped;
  }

  /**
   * Link group memberships: identities/groups → groups
   * Uses members array from group's rawData
   */
  private linkGroupMemberships(
    groups: Entity[],
    entityMap: Map<string, Entity>,
  ): RelationshipToCreate[] {
    const relationships: RelationshipToCreate[] = [];

    for (const group of groups) {
      const members = group.rawData?.members || [];

      for (const memberId of members) {
        const member = entityMap.get(memberId);
        if (!member) {
          continue; // Member not in our entity set (might be from different datasource)
        }

        relationships.push({
          parentEntityId: group._id,
          childEntityId: member._id,
          relationshipType: "group-member",
          metadata: {
            groupDisplayName: group.rawData?.displayName,
            memberDisplayName:
              member.rawData?.displayName || member.rawData?.userPrincipalName,
          },
        });
      }
    }

    Logger.log({
      module: "Microsoft365Linker",
      context: "linkGroupMemberships",
      message: `Linked ${relationships.length} group memberships`,
      level: "trace",
    });

    return relationships;
  }

  /**
   * Link role assignments: identities → roles
   * Uses members array from role's rawData
   */
  private linkRoleAssignments(
    roles: Entity[],
    entityMap: Map<string, Entity>,
  ): RelationshipToCreate[] {
    const relationships: RelationshipToCreate[] = [];

    for (const role of roles) {
      const members = role.rawData?.members || [];

      for (const memberId of members) {
        const member = entityMap.get(memberId);
        if (!member || member.entityType !== "identities") {
          continue; // Only link identities to roles
        }

        relationships.push({
          parentEntityId: role._id,
          childEntityId: member._id,
          relationshipType: "role-assignment",
          metadata: {
            roleDisplayName: role.rawData?.displayName,
            memberDisplayName:
              member.rawData?.displayName || member.rawData?.userPrincipalName,
          },
        });
      }
    }

    Logger.log({
      module: "Microsoft365Linker",
      context: "linkRoleAssignments",
      message: `Linked ${relationships.length} role assignments`,
      level: "trace",
    });

    return relationships;
  }

  /**
   * Link license assignments: identities → licenses
   * Uses assignedLicenses array from identity's rawData
   */
  private linkLicenseAssignments(
    identities: Entity[],
    entityMap: Map<string, Entity>,
  ): RelationshipToCreate[] {
    const relationships: RelationshipToCreate[] = [];

    for (const identity of identities) {
      const assignedLicenses = identity.rawData?.assignedLicenses || [];

      for (const licenseAssignment of assignedLicenses) {
        const skuId = licenseAssignment.skuId;
        const license = entityMap.get(skuId);

        if (!license || license.entityType !== "licenses") {
          continue; // License not in our entity set
        }

        relationships.push({
          parentEntityId: license._id,
          childEntityId: identity._id,
          relationshipType: "license-assignment",
          metadata: {
            licenseSkuPartNumber: license.rawData?.skuPartNumber,
            licenseFriendlyName: license.rawData?.friendlyName,
            userDisplayName:
              identity.rawData?.displayName ||
              identity.rawData?.userPrincipalName,
            disabledPlans: licenseAssignment.disabledPlans || [],
          },
        });
      }
    }

    Logger.log({
      module: "Microsoft365Linker",
      context: "linkLicenseAssignments",
      message: `Linked ${relationships.length} license assignments`,
      level: "trace",
    });

    return relationships;
  }

  /**
   * Link nested groups: group → parent group
   * Uses memberOf array from group's rawData
   */
  private linkNestedGroups(
    groups: Entity[],
    entityMap: Map<string, Entity>,
  ): RelationshipToCreate[] {
    const relationships: RelationshipToCreate[] = [];

    for (const group of groups) {
      const memberOf = group.rawData?.memberOf || [];

      for (const parentGroupId of memberOf) {
        const parentGroup = entityMap.get(parentGroupId);
        if (!parentGroup || parentGroup.entityType !== "groups") {
          continue; // Parent group not in our entity set
        }

        relationships.push({
          parentEntityId: parentGroup._id,
          childEntityId: group._id,
          relationshipType: "group-member",
          metadata: {
            parentGroupDisplayName: parentGroup.rawData?.displayName,
            childGroupDisplayName: group.rawData?.displayName,
          },
        });
      }
    }

    Logger.log({
      module: "Microsoft365Linker",
      context: "linkNestedGroups",
      message: `Linked ${relationships.length} nested group memberships`,
      level: "trace",
    });

    return relationships;
  }
}
