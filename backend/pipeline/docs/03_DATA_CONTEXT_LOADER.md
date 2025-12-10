# Phase 3: Data Context Loader

[← Back to Index](./REFACTOR_INDEX.md) | [← Previous: Logging](./02_LOGGING_OBSERVABILITY.md) | [Next: Unified Analyzer →](./04_UNIFIED_ANALYZER.md)

---

## Overview

**Goal**: Create shared data loading system to eliminate redundant queries

**Impact**: 800+ queries → 7-10 queries per analysis cycle

---

## Data Context Interface

**File**: `src/context/AnalysisContext.ts`

```typescript
import { Id, Doc } from "../../convex/_generated/dataModel";

export interface AnalysisContext {
  // Metadata
  tenantId: Id<"tenants">;
  dataSourceId: Id<"data_sources">;
  syncId: string;

  // Entities
  identities: Doc<"entities">[];
  groups: Doc<"entities">[];
  roles: Doc<"entities">[];
  policies: Doc<"entities">[];
  licenses: Doc<"entities">[];

  // Relationship maps (pre-built for O(1) lookup)
  identityToGroups: Map<Id<"entities">, Id<"entities">[]>;
  identityToRoles: Map<Id<"entities">, Id<"entities">[]>;
  groupToMembers: Map<Id<"entities">, Id<"entities">[]>;
  roleToAssignees: Map<Id<"entities">, Id<"entities">[]>;

  // Entity lookup maps
  entitiesById: Map<Id<"entities">, Doc<"entities">>;
  entitiesByExternalId: Map<string, Doc<"entities">>;

  // Changed entities (for incremental analysis)
  changedIdentityIds?: Set<Id<"entities">>;
  changedPolicyIds?: Set<Id<"entities">>;
}
```

---

## DataContextLoader Implementation

**File**: `src/context/DataContextLoader.ts`

```typescript
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";
import { Id, Doc } from "../../convex/_generated/dataModel";
import { AnalysisContext } from "./AnalysisContext";
import Logger from "../lib/logger";
import { timedQuery } from "../lib/queryWrapper";

class DataContextLoader {
  constructor(private client: ConvexHttpClient) {}

  async load(params: {
    tenantId: Id<"tenants">;
    dataSourceId: Id<"data_sources">;
    syncId: string;
    changedEntityIds?: Id<"entities">[];
  }): Promise<AnalysisContext> {
    Logger.startStage("context_load", {
      tenantId: params.tenantId,
      dataSourceId: params.dataSourceId,
    });

    const startTime = Date.now();

    // Load all entities in parallel
    const [identities, groups, roles, policies, licenses, relationships] =
      await Promise.all([
        this.loadEntities(params.dataSourceId, "identities"),
        this.loadEntities(params.dataSourceId, "groups"),
        this.loadEntities(params.dataSourceId, "roles"),
        this.loadEntities(params.dataSourceId, "policies"),
        this.loadEntities(params.dataSourceId, "licenses"),
        this.loadRelationships(params.dataSourceId),
      ]);

    // Build relationship maps
    const {
      identityToGroups,
      identityToRoles,
      groupToMembers,
      roleToAssignees,
    } = this.buildRelationshipMaps(relationships, identities, groups, roles);

    // Build entity lookup maps
    const entitiesById = new Map<Id<"entities">, Doc<"entities">>();
    const entitiesByExternalId = new Map<string, Doc<"entities">>();

    const allEntities = [
      ...identities,
      ...groups,
      ...roles,
      ...policies,
      ...licenses,
    ];

    for (const entity of allEntities) {
      entitiesById.set(entity._id, entity);
      if (entity.externalId) {
        entitiesByExternalId.set(entity.externalId, entity);
      }
    }

    // Build changed entity set
    const changedIdentityIds = params.changedEntityIds
      ? new Set(
          params.changedEntityIds.filter((id) =>
            identities.some((i) => i._id === id),
          ),
        )
      : undefined;

    const context: AnalysisContext = {
      tenantId: params.tenantId,
      dataSourceId: params.dataSourceId,
      syncId: params.syncId,
      identities,
      groups,
      roles,
      policies,
      licenses,
      identityToGroups,
      identityToRoles,
      groupToMembers,
      roleToAssignees,
      entitiesById,
      entitiesByExternalId,
      changedIdentityIds,
    };

    const duration = Date.now() - startTime;

    Logger.endStage("context_load", {
      identities: identities.length,
      groups: groups.length,
      roles: roles.length,
      policies: policies.length,
      licenses: licenses.length,
      relationships: relationships.length,
      duration_ms: duration,
    });

    return context;
  }

  private async loadEntities(
    dataSourceId: Id<"data_sources">,
    entityType: string,
  ): Promise<Doc<"entities">[]> {
    return await timedQuery(
      this.client,
      `load_${entityType}`,
      "entities",
      async () => {
        return await this.client.query(api.helpers.orm.list_s, {
          tableName: "entities",
          index: {
            name: "by_data_source_type",
            params: { dataSourceId, entityType },
          },
        });
      },
    );
  }

  private async loadRelationships(
    dataSourceId: Id<"data_sources">,
  ): Promise<Doc<"entity_relationships">[]> {
    return await timedQuery(
      this.client,
      "load_relationships",
      "entity_relationships",
      async () => {
        return await this.client.query(api.helpers.orm.list_s, {
          tableName: "entity_relationships",
          filters: { dataSourceId },
        });
      },
    );
  }

  private buildRelationshipMaps(
    relationships: Doc<"entity_relationships">[],
    identities: Doc<"entities">[],
    groups: Doc<"entities">[],
    roles: Doc<"entities">[],
  ) {
    const identityToGroups = new Map<Id<"entities">, Id<"entities">[]>();
    const identityToRoles = new Map<Id<"entities">, Id<"entities">[]>();
    const groupToMembers = new Map<Id<"entities">, Id<"entities">[]>();
    const roleToAssignees = new Map<Id<"entities">, Id<"entities">[]>();

    // Build sets for O(1) type checking
    const groupIds = new Set(groups.map((g) => g._id));
    const roleIds = new Set(roles.map((r) => r._id));
    const identityIds = new Set(identities.map((i) => i._id));

    for (const rel of relationships) {
      const parent = rel.parentEntityId;
      const child = rel.childEntityId;

      // Identity → Group
      if (identityIds.has(child) && groupIds.has(parent)) {
        if (!identityToGroups.has(child)) {
          identityToGroups.set(child, []);
        }
        identityToGroups.get(child)!.push(parent);

        if (!groupToMembers.has(parent)) {
          groupToMembers.set(parent, []);
        }
        groupToMembers.get(parent)!.push(child);
      }

      // Identity → Role
      if (identityIds.has(child) && roleIds.has(parent)) {
        if (!identityToRoles.has(child)) {
          identityToRoles.set(child, []);
        }
        identityToRoles.get(child)!.push(parent);

        if (!roleToAssignees.has(parent)) {
          roleToAssignees.set(parent, []);
        }
        roleToAssignees.get(parent)!.push(child);
      }
    }

    return {
      identityToGroups,
      identityToRoles,
      groupToMembers,
      roleToAssignees,
    };
  }
}

export default DataContextLoader;
```

---

## Usage Example

```typescript
// Before (in each worker):
const identities = await client.query(/* fetch identities */); // Query 1
const policies = await client.query(/* fetch policies */); // Query 2
const groups = await client.query(/* fetch groups */); // Query 3
for (const identity of identities) {
  const userGroups = await client.query(/* fetch per identity */); // N queries
}
// Total: 3 + N queries

// After (in UnifiedAnalyzer):
const context = await loader.load({
  tenantId,
  dataSourceId,
  syncId,
});

// All data already loaded
const identities = context.identities;
const policies = context.policies;
const groups = context.groups;

// O(1) lookups
for (const identity of identities) {
  const userGroupIds = context.identityToGroups.get(identity._id) || [];
  const userGroups = userGroupIds.map((id) => context.entitiesById.get(id));
}
// Total: 7 queries (fixed, not scaling with N)
```

---

## Helper Functions

**File**: `src/context/AnalysisHelpers.ts`

```typescript
import { AnalysisContext } from "./AnalysisContext";
import { Id, Doc } from "../../convex/_generated/dataModel";

export class AnalysisHelpers {
  /**
   * Get all groups for an identity
   */
  static getGroupsForIdentity(
    context: AnalysisContext,
    identityId: Id<"entities">,
  ): Doc<"entities">[] {
    const groupIds = context.identityToGroups.get(identityId) || [];
    return groupIds
      .map((id) => context.entitiesById.get(id))
      .filter((g): g is Doc<"entities"> => g !== undefined);
  }

  /**
   * Check if identity is in specific group
   */
  static isInGroup(
    context: AnalysisContext,
    identityId: Id<"entities">,
    groupName: string,
  ): boolean {
    const groups = this.getGroupsForIdentity(context, identityId);
    return groups.some((g) => g.normalizedData?.name === groupName);
  }

  /**
   * Get all roles for an identity
   */
  static getRolesForIdentity(
    context: AnalysisContext,
    identityId: Id<"entities">,
  ): Doc<"entities">[] {
    const roleIds = context.identityToRoles.get(identityId) || [];
    return roleIds
      .map((id) => context.entitiesById.get(id))
      .filter((r): r is Doc<"entities"> => r !== undefined);
  }

  /**
   * Check if policy applies to identity (via groups or direct)
   */
  static doesPolicyApply(
    context: AnalysisContext,
    policyId: Id<"entities">,
    identityId: Id<"entities">,
  ): boolean {
    const policy = context.entitiesById.get(policyId);
    if (!policy || !policy.normalizedData) {
      return false;
    }

    // Check include groups
    const includeGroups = policy.normalizedData.includeGroups || [];
    const excludeGroups = policy.normalizedData.excludeGroups || [];

    const userGroups = this.getGroupsForIdentity(context, identityId);
    const userGroupNames = new Set(
      userGroups.map((g) => g.normalizedData?.name),
    );

    // Excluded?
    if (excludeGroups.some((g: string) => userGroupNames.has(g))) {
      return false;
    }

    // Included?
    if (includeGroups.length === 0) {
      return true; // Applies to all if no include groups
    }

    return includeGroups.some((g: string) => userGroupNames.has(g));
  }

  /**
   * Filter identities to only those that changed
   */
  static getIdentitiesToAnalyze(
    context: AnalysisContext,
    changedEntityIds?: Id<"entities">[],
  ): Doc<"entities">[] {
    if (!changedEntityIds || changedEntityIds.length === 0) {
      return context.identities; // Analyze all
    }

    const changedSet = new Set(changedEntityIds);
    return context.identities.filter((i) => changedSet.has(i._id));
  }
}
```

---

## Testing

```typescript
describe("DataContextLoader", () => {
  it("should load all entities and relationships", async () => {
    const context = await loader.load({
      tenantId: "test",
      dataSourceId: "test",
      syncId: "test_sync",
    });

    expect(context.identities.length).toBeGreaterThan(0);
    expect(context.groups.length).toBeGreaterThan(0);
    expect(context.identityToGroups.size).toBeGreaterThan(0);
  });

  it("should build correct relationship maps", async () => {
    const context = await loader.load({
      /* ... */
    });

    const identity = context.identities[0];
    const groupIds = context.identityToGroups.get(identity._id);

    expect(groupIds).toBeDefined();
    expect(groupIds!.length).toBeGreaterThan(0);

    // Reverse mapping should be consistent
    for (const groupId of groupIds!) {
      const members = context.groupToMembers.get(groupId);
      expect(members).toContain(identity._id);
    }
  });

  it("should handle changed entities filtering", async () => {
    const changedIds = [identities[0]._id, identities[1]._id];

    const toAnalyze = AnalysisHelpers.getIdentitiesToAnalyze(
      context,
      changedIds,
    );

    expect(toAnalyze.length).toBe(2);
    expect(toAnalyze.map((i) => i._id)).toEqual(changedIds);
  });

  it("should be significantly faster than N queries", async () => {
    const start = Date.now();
    const context = await loader.load({
      /* ... */
    });
    const loadTime = Date.now() - start;

    expect(loadTime).toBeLessThan(5000); // <5s for full load
    expect(context.identities.length).toBeGreaterThan(0);

    // Accessing relationships should be O(1)
    const lookupStart = Date.now();
    for (const identity of context.identities) {
      const groups = context.identityToGroups.get(identity._id);
    }
    const lookupTime = Date.now() - lookupStart;

    expect(lookupTime).toBeLessThan(100); // <100ms for all lookups
  });
});
```

---

## Performance Benchmarks

### Expected Results

```
Before (separate workers):
- Query count: 800-1400
- Total time: 15+ minutes
- DB connections: High

After (DataContextLoader):
- Query count: 7-10
- Total time: <30 seconds
- DB connections: Low
```

---

## Success Criteria

- [ ] All entity types loaded in single pass
- [ ] Relationship maps built correctly
- [ ] Helper functions provide O(1) lookups
- [ ] Query count reduced by >90%
- [ ] Context load completes in <5 seconds
- [ ] Tests verify correctness

---

[→ Next: Phase 4 - Unified Analyzer](./04_UNIFIED_ANALYZER.md)
