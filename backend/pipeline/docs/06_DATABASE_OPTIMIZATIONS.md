# Phase 6: Database Optimizations

[← Back to Index](./REFACTOR_INDEX.md) | [← Previous: Alert System](./05_ALERT_SYSTEM.md) | [Next: Migration & Deployment →](./07_MIGRATION_DEPLOYMENT.md)

---

## Overview

**Goal**: Optimize database queries and indexes for performance

**Key Optimizations**:

1. Add missing composite indexes
2. Optimize Linker (eliminate N+1 queries)
3. Query batching and performance monitoring

---

## Optimization 1: Add Missing Indexes

### Analysis of Current Queries

```typescript
// Frequent query patterns:

// 1. Alert queries
WHERE entityId = ? AND alertType = ? AND status = 'active'
// Current index: by_entity_type [entityId, alertType]
// Missing: status in index

// 2. Scheduled jobs (if keeping)
WHERE scheduledAt <= ? AND status = 'pending'
// Current index: by_status [status]
// Missing: scheduledAt in index

// 3. Alert history queries
WHERE alertId = ? ORDER BY changedAt DESC
// Current index: by_alert [alertId]
// Good, but could benefit from sorting

// 4. Entity relationships
WHERE parentEntityId = ? AND childEntityId = ?
// Need composite index for bidirectional lookups
```

### Schema Updates

**File**: `convex/schema.ts`

```typescript
// Update existing indexes

defineTable("entity_alerts", {
  // ... existing fields
})
  .index("by_entity_status", ["entityId", "status"]) // NEW
  .index("by_entity_type", ["entityId", "alertType"])
  .index("by_entity_type_status", ["entityId", "alertType", "status"]) // NEW
  .index("by_tenant_status", ["tenantId", "status"]) // NEW
  .index("by_data_source_status", ["dataSourceId", "status"]); // NEW

defineTable("entity_alert_history", {
  // ... existing fields
})
  .index("by_alert", ["alertId", "changedAt"]) // Add sort field
  .index("by_entity", ["entityId", "changedAt"])
  .index("by_tenant", ["tenantId", "changedAt"])
  .index("by_sync", ["syncId"]);

defineTable("entity_relationships", {
  // ... existing fields
})
  .index("by_parent", ["parentEntityId"])
  .index("by_child", ["childEntityId"])
  .index("by_parent_child", ["parentEntityId", "childEntityId"]) // NEW
  .index("by_data_source", ["dataSourceId"]); // For bulk loading

// If keeping scheduled_jobs table
defineTable("scheduled_jobs", {
  // ... existing fields
})
  .index("by_status", ["status"])
  .index("by_scheduled_at", ["scheduledAt"]) // NEW
  .index("by_status_scheduled", ["status", "scheduledAt"]) // NEW
  .index("by_tenant_status", ["tenantId", "status"]); // NEW
```

### Migration Script

**File**: `scripts/migrateIndexes.ts`

```typescript
// Convex automatically handles index creation
// Just deploy the schema changes

// But verify no performance degradation during migration
import { ConvexHttpClient } from "convex/browser";

async function verifyIndexes() {
  const client = new ConvexHttpClient(process.env.CONVEX_URL!);

  console.log("Testing index performance...");

  // Test alert queries
  const startAlerts = Date.now();
  const alerts = await client.query(api.helpers.orm.list_s, {
    tableName: "entity_alerts",
    index: {
      name: "by_entity_type_status",
      params: {
        entityId: "test_id",
        alertType: "mfa_not_enforced",
        status: "active",
      },
    },
  });
  const alertsTime = Date.now() - startAlerts;
  console.log(`Alert query: ${alertsTime}ms (should be <100ms)`);

  // Test relationship queries
  const startRels = Date.now();
  const rels = await client.query(api.helpers.orm.list_s, {
    tableName: "entity_relationships",
    index: {
      name: "by_data_source",
      params: { dataSourceId: "test_datasource" },
    },
  });
  const relsTime = Date.now() - startRels;
  console.log(`Relationship query: ${relsTime}ms (should be <500ms)`);

  console.log("Index verification complete");
}
```

---

## Optimization 2: Linker Performance

### Current Problem (N+1 Queries)

**File**: `src/linkers/Microsoft365Linker.ts`

```typescript
// BEFORE (Current implementation)
for (const group of groups) {
  // 50 groups
  const { data: members } = await connector.getGroupMembers(group.externalId);

  for (const member of members) {
    // 300 total members
    // Check if relationship exists - QUERY PER MEMBER!
    const existingRels = await client.query(api.helpers.orm.list_s, {
      tableName: "entity_relationships",
      index: {
        name: "by_parent",
        params: { parentEntityId: group._id },
      },
    });

    const exists = existingRels.some((r) => r.childEntityId === member._id);
    if (!exists) {
      relationshipsToCreate.push({ parent: group._id, child: member._id });
    }
  }
}

// Total: 50 API calls + 300 DB queries
```

### Optimized Implementation

```typescript
// AFTER (Optimized)
private async linkGroupMemberships(
  groups: Doc<'entities'>[],
  connector: Microsoft365Connector
): Promise<void> {
  Logger.startStage('link_groups');

  // STEP 1: Fetch ALL existing relationships upfront (1 query)
  const existingRelationships = await timedQuery(
    this.client,
    'fetch_all_group_relationships',
    'entity_relationships',
    async () => {
      return await this.client.query(api.helpers.orm.list_s, {
        tableName: 'entity_relationships',
        index: {
          name: 'by_data_source',
          params: { dataSourceId: this.dataSourceId },
        },
      });
    }
  );

  // Build lookup set for O(1) existence checks
  const existingSet = new Set(
    existingRelationships.map(
      r => `${r.parentEntityId}:${r.childEntityId}`
    )
  );

  // STEP 2: Fetch group members from API and build create/delete lists
  const relationshipsToCreate: any[] = [];
  const relationshipsToDelete: any[] = [];
  const currentRelationshipsSet = new Set<string>();

  for (const group of groups) {
    try {
      const { data: members } = await connector.getGroupMembers(group.externalId);

      for (const member of members) {
        const memberEntity = await this.findEntityByExternalId(member.id);
        if (!memberEntity) continue;

        const key = `${group._id}:${memberEntity._id}`;
        currentRelationshipsSet.add(key);

        // O(1) lookup instead of query
        if (!existingSet.has(key)) {
          relationshipsToCreate.push({
            parentEntityId: group._id,
            childEntityId: memberEntity._id,
            dataSourceId: this.dataSourceId,
            relationshipType: 'member_of',
            metadata: {},
          });
        }
      }
    } catch (error) {
      Logger.log({
        module: 'Microsoft365Linker',
        context: 'linkGroupMemberships',
        message: `Failed to fetch members for group ${group.externalId}`,
        level: 'error',
        error: error as Error,
      });
    }
  }

  // STEP 3: Find relationships to delete (members removed from groups)
  for (const existing of existingRelationships) {
    const key = `${existing.parentEntityId}:${existing.childEntityId}`;
    if (!currentRelationshipsSet.has(key)) {
      relationshipsToDelete.push(existing._id);
    }
  }

  // STEP 4: Batch create and delete
  if (relationshipsToCreate.length > 0) {
    await this.batchInsertRelationships(relationshipsToCreate);
  }

  if (relationshipsToDelete.length > 0) {
    await this.batchDeleteRelationships(relationshipsToDelete);
  }

  Logger.endStage('link_groups', {
    groupsProcessed: groups.length,
    relationshipsCreated: relationshipsToCreate.length,
    relationshipsDeleted: relationshipsToDelete.length,
  });
}

private async batchInsertRelationships(relationships: any[]): Promise<void> {
  // Insert in batches of 100
  const batchSize = 100;
  for (let i = 0; i < relationships.length; i += batchSize) {
    const batch = relationships.slice(i, i + batchSize);

    await Promise.all(
      batch.map(rel =>
        this.client.mutation(api.helpers.orm.insert_s, {
          tableName: 'entity_relationships',
          record: rel,
        })
      )
    );
  }

  Logger.log({
    module: 'Microsoft365Linker',
    context: 'batchInsertRelationships',
    message: `Created ${relationships.length} relationships`,
  });
}

private async batchDeleteRelationships(ids: Id<'entity_relationships'>[]): Promise<void> {
  await Promise.all(
    ids.map(id =>
      this.client.mutation(api.helpers.orm.delete_s, {
        tableName: 'entity_relationships',
        id,
      })
    )
  );

  Logger.log({
    module: 'Microsoft365Linker',
    context: 'batchDeleteRelationships',
    message: `Deleted ${ids.length} relationships`,
  });
}

// Cache entity lookups
private entityCache = new Map<string, Doc<'entities'>>();

private async findEntityByExternalId(externalId: string): Promise<Doc<'entities'> | null> {
  if (this.entityCache.has(externalId)) {
    return this.entityCache.get(externalId)!;
  }

  const entities = await this.client.query(api.helpers.orm.list_s, {
    tableName: 'entities',
    index: {
      name: 'by_external_id',
      params: { externalId, tenantId: this.tenantId },
    },
  });

  const entity = entities[0] || null;
  if (entity) {
    this.entityCache.set(externalId, entity);
  }

  return entity;
}
```

### Performance Impact

```
Before:
- 50 API calls (unavoidable)
- 300 DB queries (checking existence)
- Total time: ~2 minutes

After:
- 50 API calls (same)
- 1 DB query (fetch all relationships)
- O(1) set lookups (300 checks, <1ms)
- Batch inserts (100 at a time)
- Total time: ~10 seconds

Improvement: 12x faster
```

---

## Optimization 3: Query Performance Monitoring

Already implemented in Phase 2, but add metrics:

### Query Performance Metrics

**File**: `src/lib/queryMetrics.ts`

```typescript
interface QueryMetric {
  tableName: string;
  operation: string;
  duration: number;
  recordCount: number;
  timestamp: number;
}

class QueryMetrics {
  private static metrics: QueryMetric[] = [];
  private static readonly MAX_METRICS = 1000;

  static record(metric: QueryMetric): void {
    this.metrics.push(metric);

    // Keep only recent metrics
    if (this.metrics.length > this.MAX_METRICS) {
      this.metrics = this.metrics.slice(-this.MAX_METRICS);
    }
  }

  static getSlowQueries(threshold = 1000): QueryMetric[] {
    return this.metrics.filter((m) => m.duration > threshold);
  }

  static getAverageByTable(): Map<string, number> {
    const byTable = new Map<string, { total: number; count: number }>();

    for (const metric of this.metrics) {
      if (!byTable.has(metric.tableName)) {
        byTable.set(metric.tableName, { total: 0, count: 0 });
      }

      const stats = byTable.get(metric.tableName)!;
      stats.total += metric.duration;
      stats.count++;
    }

    const averages = new Map<string, number>();
    for (const [table, stats] of byTable.entries()) {
      averages.set(table, stats.total / stats.count);
    }

    return averages;
  }

  static getSummary(): string {
    const slowQueries = this.getSlowQueries();
    const avgByTable = this.getAverageByTable();

    let summary = "=== Query Performance Summary ===\n\n";
    summary += `Total queries: ${this.metrics.length}\n`;
    summary += `Slow queries (>1s): ${slowQueries.length}\n\n`;

    summary += "Average duration by table:\n";
    for (const [table, avg] of avgByTable.entries()) {
      summary += `  ${table}: ${avg.toFixed(2)}ms\n`;
    }

    if (slowQueries.length > 0) {
      summary += "\nSlowest queries:\n";
      const slowest = slowQueries
        .sort((a, b) => b.duration - a.duration)
        .slice(0, 10);

      for (const query of slowest) {
        summary += `  ${query.operation} on ${query.tableName}: ${query.duration}ms (${query.recordCount} records)\n`;
      }
    }

    return summary;
  }
}

export default QueryMetrics;
```

### Integrate with timedQuery

```typescript
// Update timedQuery wrapper
export async function timedQuery<T>(
  client: ConvexHttpClient,
  operation: string,
  tableName: string,
  queryFn: () => Promise<T>,
): Promise<T> {
  const startTime = Date.now();

  try {
    const result = await queryFn();
    const duration = Date.now() - startTime;
    const recordCount = Array.isArray(result) ? result.length : 1;

    // Record metric
    QueryMetrics.record({
      tableName,
      operation,
      duration,
      recordCount,
      timestamp: Date.now(),
    });

    Logger.logQuery({
      tableName,
      operation,
      recordsAffected: recordCount,
      duration,
    });

    return result;
  } catch (error) {
    // ... error handling
  }
}
```

---

## Testing Performance Improvements

### Benchmark Script

**File**: `scripts/benchmarkQueries.ts`

```typescript
async function benchmarkQueries() {
  console.log("Running query benchmarks...\n");

  // Test 1: Alert query with new index
  console.log("Test 1: Alert query by entity + type + status");
  const start1 = Date.now();
  for (let i = 0; i < 100; i++) {
    await client.query(api.helpers.orm.list_s, {
      tableName: "entity_alerts",
      index: {
        name: "by_entity_type_status",
        params: {
          entityId: testEntityId,
          alertType: "mfa_not_enforced",
          status: "active",
        },
      },
    });
  }
  const time1 = Date.now() - start1;
  console.log(
    `  100 queries: ${time1}ms (${(time1 / 100).toFixed(2)}ms avg)\n`,
  );

  // Test 2: Relationship bulk load
  console.log("Test 2: Bulk load relationships");
  const start2 = Date.now();
  const rels = await client.query(api.helpers.orm.list_s, {
    tableName: "entity_relationships",
    index: {
      name: "by_data_source",
      params: { dataSourceId: testDataSourceId },
    },
  });
  const time2 = Date.now() - start2;
  console.log(`  Loaded ${rels.length} relationships: ${time2}ms\n`);

  // Test 3: Alert history query
  console.log("Test 3: Alert history with sorting");
  const start3 = Date.now();
  const history = await client.query(api.helpers.orm.list_s, {
    tableName: "entity_alert_history",
    index: {
      name: "by_entity",
      params: { entityId: testEntityId },
    },
  });
  const time3 = Date.now() - start3;
  console.log(`  Loaded ${history.length} history records: ${time3}ms\n`);

  // Print summary
  console.log("=== Performance Targets ===");
  console.log(`Alert query: ${(time1 / 100).toFixed(2)}ms (target: <10ms)`);
  console.log(`Bulk relationships: ${time2}ms (target: <500ms)`);
  console.log(`Alert history: ${time3}ms (target: <100ms)`);
}
```

---

## Success Criteria

- [ ] All new indexes deployed
- [ ] Alert queries <10ms
- [ ] Relationship bulk load <500ms
- [ ] Linker 10x faster (2min → 10s)
- [ ] No slow queries >1s in production
- [ ] Query metrics show improvement

---

[→ Next: Phase 7 - Migration & Deployment](./07_MIGRATION_DEPLOYMENT.md)
