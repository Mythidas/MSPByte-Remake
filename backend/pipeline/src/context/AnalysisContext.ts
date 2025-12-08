/**
 * AnalysisContext - Shared data context for all analyzers
 *
 * This interface defines the structure of data loaded by DataContextLoader.
 * It eliminates redundant database queries by loading all required data once
 * and providing pre-computed relationship maps for O(1) lookups.
 *
 * Usage:
 *   const context = await dataContextLoader.load(tenantId, dataSourceId);
 *   const groups = getGroupsForIdentity(context, identityId);
 */

import type { Doc, Id } from "@workspace/database/convex/_generated/dataModel.js";

/**
 * Pre-computed relationship maps for O(1) lookups
 */
export interface RelationshipMaps {
  // Identity relationships
  identityToGroups: Map<Id<"entities">, Id<"entities">[]>;  // identity → groups they're in
  identityToRoles: Map<Id<"entities">, Id<"entities">[]>;   // identity → roles they have
  identityToLicenses: Map<Id<"entities">, Id<"entities">[]>; // identity → licenses assigned
  identityToPolicies: Map<Id<"entities">, Id<"entities">[]>; // identity → policies that apply

  // Group relationships
  groupToMembers: Map<Id<"entities">, Id<"entities">[]>;    // group → member identities

  // Role relationships
  roleToAssignees: Map<Id<"entities">, Id<"entities">[]>;   // role → identities with this role

  // Policy relationships
  policyToTargets: Map<Id<"entities">, Id<"entities">[]>;   // policy → identities/groups it applies to

  // License relationships
  licenseToHolders: Map<Id<"entities">, Id<"entities">[]>;  // license → identities that have it

  // Company relationships (for multi-entity scenarios)
  companyToEndpoints: Map<Id<"entities">, Id<"entities">[]>; // company → endpoints
  companyToFirewalls: Map<Id<"entities">, Id<"entities">[]>; // company → firewalls
}

/**
 * Entity lookup maps for fast retrieval
 */
export interface EntityMaps {
  // By internal ID
  entitiesById: Map<Id<"entities">, Doc<"entities">>;

  // By external ID (from source system)
  entitiesByExternalId: Map<string, Doc<"entities">>;

  // By type (for quick filtering)
  identitiesById: Map<Id<"entities">, Doc<"entities">>;
  groupsById: Map<Id<"entities">, Doc<"entities">>;
  rolesById: Map<Id<"entities">, Doc<"entities">>;
  policiesById: Map<Id<"entities">, Doc<"entities">>;
  licensesById: Map<Id<"entities">, Doc<"entities">>;
  companiesById: Map<Id<"entities">, Doc<"entities">>;
  endpointsById: Map<Id<"entities">, Doc<"entities">>;
  firewallsById: Map<Id<"entities">, Doc<"entities">>;
}

/**
 * Main Analysis Context containing all data needed for analysis
 */
export interface AnalysisContext {
  // Metadata
  tenantId: Id<"tenants">;
  dataSourceId: Id<"data_sources">;
  loadedAt: number; // Timestamp when context was loaded
  integrationType: string; // e.g., "microsoft-365", "sophos-partner"

  // Entity arrays (for iteration)
  identities: Doc<"entities">[];
  groups: Doc<"entities">[];
  roles: Doc<"entities">[];
  policies: Doc<"entities">[];
  licenses: Doc<"entities">[];
  companies: Doc<"entities">[];
  endpoints: Doc<"entities">[];
  firewalls: Doc<"entities">[];

  // All relationships (for direct access)
  relationships: Doc<"entity_relationships">[];

  // Pre-computed maps for O(1) lookups
  relationshipMaps: RelationshipMaps;
  entityMaps: EntityMaps;

  // Changed entities (for incremental analysis)
  changedEntityIds?: Id<"entities">[];

  // Statistics (for monitoring)
  stats: {
    totalEntities: number;
    totalRelationships: number;
    loadTimeMs: number;
    queryCount: number;
  };
}

/**
 * Options for loading context
 */
export interface LoadContextOptions {
  // Only load entities that changed (for incremental analysis)
  changedEntityIds?: Id<"entities">[];

  // Entity types to load (default: all)
  entityTypes?: string[];

  // Whether to load relationships (default: true)
  includeRelationships?: boolean;

  // Whether to include soft-deleted entities (default: false)
  includeSoftDeleted?: boolean;
}
