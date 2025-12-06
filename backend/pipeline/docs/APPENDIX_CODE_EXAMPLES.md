# Appendix: Code Examples & Utilities

[← Back to Index](./REFACTOR_INDEX.md)

---

## Quick Reference

This appendix contains reusable code examples, utility functions, and debugging tools.

---

## 1. Debugging Tools

### View Trace Logs

```bash
# View all logs for a specific sync
npm run view-trace -- --syncId=sync_abc123

# View logs for a tenant
npm run view-trace -- --tenantId=tenant_xyz

# View logs for specific stage
npm run view-trace -- --stage=analyze
```

**Implementation**: `scripts/viewTrace.ts`

```typescript
import fs from 'fs';
import { parseArgs } from 'util';

interface LogEntry {
  timestamp: string;
  level: string;
  module: string;
  context: string;
  message: string;
  traceId?: string;
  syncId?: string;
  tenantId?: string;
  stage?: string;
  duration_ms?: number;
  metadata?: any;
}

function viewTrace() {
  const { values } = parseArgs({
    options: {
      syncId: { type: 'string' },
      tenantId: { type: 'string' },
      stage: { type: 'string' },
      file: { type: 'string', default: './logs/pipeline.log' },
    },
  });

  const logs = fs
    .readFileSync(values.file!, 'utf-8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as LogEntry)
    .filter((log) => {
      if (values.syncId && log.syncId !== values.syncId) return false;
      if (values.tenantId && log.tenantId !== values.tenantId) return false;
      if (values.stage && log.stage !== values.stage) return false;
      return true;
    });

  console.log(`\n=== Found ${logs.length} matching log entries ===\n`);

  // Group by trace
  const byTrace = new Map<string, LogEntry[]>();
  for (const log of logs) {
    const key = log.traceId || log.syncId || 'unknown';
    if (!byTrace.has(key)) {
      byTrace.set(key, []);
    }
    byTrace.get(key)!.push(log);
  }

  // Display each trace
  for (const [traceId, traceLogs] of byTrace.entries()) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`Trace: ${traceId}`);
    console.log(`${'='.repeat(80)}\n`);

    for (const log of traceLogs) {
      const time = new Date(log.timestamp).toLocaleTimeString();
      console.log(`[${time}] ${log.module}:${log.context}`);
      console.log(`  ${log.message}`);

      if (log.duration_ms) {
        console.log(`  Duration: ${log.duration_ms}ms`);
      }

      if (log.metadata && Object.keys(log.metadata).length > 0) {
        console.log(`  Metadata:`, JSON.stringify(log.metadata, null, 2));
      }

      console.log();
    }

    // Summary
    const totalDuration = traceLogs.reduce(
      (sum, log) => sum + (log.duration_ms || 0),
      0
    );
    const stages = new Set(traceLogs.map((l) => l.stage).filter(Boolean));

    console.log(`Summary:`);
    console.log(`  Total Duration: ${totalDuration}ms`);
    console.log(`  Stages: ${Array.from(stages).join(', ')}`);
    console.log(`  Log Entries: ${traceLogs.length}`);
  }
}

viewTrace();
```

### Alert History Viewer

```typescript
// scripts/viewAlertHistory.ts

async function viewAlertHistory(entityId: string) {
  const client = new ConvexHttpClient(process.env.CONVEX_URL!);

  const history = await client.query(api.helpers.orm.list_s, {
    tableName: 'entity_alert_history',
    index: {
      name: 'by_entity',
      params: { entityId },
    },
  });

  const entity = await client.query(api.helpers.orm.get_s, {
    tableName: 'entities',
    id: entityId,
  });

  console.log(`\n=== Alert History for ${entity.normalizedData?.email} ===\n`);

  // Sort by time
  history.sort((a, b) => a.changedAt - b.changedAt);

  for (const entry of history) {
    const time = new Date(entry.changedAt).toLocaleString();
    const arrow = `${entry.previousStatus} → ${entry.newStatus}`;

    console.log(`[${time}] ${entry.alertType}: ${arrow}`);

    if (entry.previousSeverity !== entry.newSeverity) {
      console.log(`  Severity: ${entry.previousSeverity} → ${entry.newSeverity}`);
    }

    console.log(`  Changed by: ${entry.changedBy}`);

    if (entry.metadata) {
      console.log(`  Reason: ${entry.metadata.reason || 'N/A'}`);
    }

    console.log();
  }

  // Timeline visualization
  console.log('\nTimeline:');
  for (const entry of history) {
    const symbol = entry.newStatus === 'active' ? '🔴' : '✅';
    const time = new Date(entry.changedAt).toLocaleDateString();
    console.log(`  ${time} ${symbol} ${entry.alertType}`);
  }
}

// Usage: ts-node scripts/viewAlertHistory.ts <entityId>
viewAlertHistory(process.argv[2]);
```

---

## 2. Testing Utilities

### Mock Data Generator

```typescript
// tests/utils/mockData.ts

export class MockDataGenerator {
  static createIdentity(overrides?: Partial<Doc<'entities'>>): Doc<'entities'> {
    return {
      _id: `identity_${Math.random()}` as Id<'entities'>,
      _creationTime: Date.now(),
      tenantId: 'test_tenant' as Id<'tenants'>,
      dataSourceId: 'test_datasource' as Id<'data_sources'>,
      entityType: 'identities',
      externalId: `user_${Math.random()}`,
      syncId: 'test_sync',
      normalizedData: {
        email: `user${Math.random()}@example.com`,
        enabled: true,
        last_login_at: Date.now() - 30 * 24 * 60 * 60 * 1000, // 30 days ago
        assignedLicenses: [],
      },
      ...overrides,
    };
  }

  static createPolicy(overrides?: Partial<Doc<'entities'>>): Doc<'entities'> {
    return {
      _id: `policy_${Math.random()}` as Id<'entities'>,
      _creationTime: Date.now(),
      tenantId: 'test_tenant' as Id<'tenants'>,
      dataSourceId: 'test_datasource' as Id<'data_sources'>,
      entityType: 'policies',
      externalId: `policy_${Math.random()}`,
      syncId: 'test_sync',
      normalizedData: {
        displayName: 'Test Policy',
        mfaState: 'enabled',
        includeGroups: ['All Users'],
        excludeGroups: [],
      },
      ...overrides,
    };
  }

  static createAnalysisContext(overrides?: Partial<AnalysisContext>): AnalysisContext {
    const identities = Array.from({ length: 10 }, () => this.createIdentity());
    const policies = [this.createPolicy()];
    const groups: Doc<'entities'>[] = [];
    const roles: Doc<'entities'>[] = [];
    const licenses: Doc<'entities'>[] = [];

    return {
      tenantId: 'test_tenant' as Id<'tenants'>,
      dataSourceId: 'test_datasource' as Id<'data_sources'>,
      syncId: 'test_sync',
      identities,
      groups,
      roles,
      policies,
      licenses,
      identityToGroups: new Map(),
      identityToRoles: new Map(),
      groupToMembers: new Map(),
      roleToAssignees: new Map(),
      entitiesById: new Map(identities.map((e) => [e._id, e])),
      entitiesByExternalId: new Map(identities.map((e) => [e.externalId!, e])),
      ...overrides,
    };
  }
}
```

### Test Helpers

```typescript
// tests/utils/testHelpers.ts

export async function waitForAnalysis(timeout = 10000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const status = await checkAnalysisComplete();
    if (status) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('Analysis did not complete within timeout');
}

export async function getActiveAlerts(
  entityId: Id<'entities'>
): Promise<Doc<'entity_alerts'>[]> {
  const client = new ConvexHttpClient(process.env.CONVEX_URL!);
  return await client.query(api.helpers.orm.list_s, {
    tableName: 'entity_alerts',
    filters: {
      entityId,
      status: 'active',
    },
  });
}

export async function clearTestData(): Promise<void> {
  const client = new ConvexHttpClient(process.env.CONVEX_URL!);

  // Delete test entities
  const entities = await client.query(api.helpers.orm.list_s, {
    tableName: 'entities',
    filters: {
      tenantId: 'test_tenant',
    },
  });

  for (const entity of entities) {
    await client.mutation(api.helpers.orm.delete_s, {
      tableName: 'entities',
      id: entity._id,
    });
  }

  // Clear test alerts, relationships, etc.
}
```

---

## 3. Performance Testing

### Load Test Script

```typescript
// scripts/loadTest.ts

async function loadTest() {
  const client = new ConvexHttpClient(process.env.CONVEX_URL!);
  const queueManager = new QueueManager(client, NatsClient);

  await queueManager.initialize();

  console.log('Starting load test...\n');

  // Test 1: Queue many jobs
  console.log('Test 1: Queueing 1000 jobs');
  const start1 = Date.now();

  const jobIds: string[] = [];
  for (let i = 0; i < 1000; i++) {
    const jobId = await queueManager.scheduleJob({
      action: 'test.sync',
      tenantId: 'test_tenant' as Id<'tenants'>,
      dataSourceId: 'test_datasource' as Id<'data_sources'>,
      priority: Math.floor(Math.random() * 10),
    });
    jobIds.push(jobId);
  }

  const time1 = Date.now() - start1;
  console.log(`  Queued 1000 jobs in ${time1}ms (${(time1 / 1000).toFixed(2)}ms avg)\n`);

  // Test 2: Job processing throughput
  console.log('Test 2: Waiting for jobs to complete');
  const start2 = Date.now();

  let completed = 0;
  const checkInterval = setInterval(async () => {
    const statuses = await Promise.all(
      jobIds.map((id) => queueManager.getJobStatus(id))
    );
    completed = statuses.filter((s) => s?.state === 'completed').length;
    console.log(`  Progress: ${completed}/1000 completed`);

    if (completed === 1000) {
      clearInterval(checkInterval);
      const time2 = Date.now() - start2;
      console.log(`\n  All jobs completed in ${time2}ms`);
      console.log(`  Throughput: ${(1000 / (time2 / 1000)).toFixed(2)} jobs/sec\n`);

      // Test 3: Analysis performance
      await testAnalysisPerformance();
    }
  }, 1000);
}

async function testAnalysisPerformance() {
  console.log('Test 3: Analysis performance with large dataset');

  // Create large dataset
  const client = new ConvexHttpClient(process.env.CONVEX_URL!);

  for (let i = 0; i < 1000; i++) {
    await client.mutation(api.helpers.orm.insert_s, {
      tableName: 'entities',
      record: MockDataGenerator.createIdentity({
        email: `loadtest${i}@example.com`,
      }),
    });
  }

  // Run analysis
  const unifiedAnalyzer = new UnifiedAnalyzer(client);
  const start = Date.now();

  await unifiedAnalyzer.execute({
    tenantId: 'test_tenant' as Id<'tenants'>,
    dataSourceId: 'test_datasource' as Id<'data_sources'>,
    syncId: 'loadtest_sync',
  });

  const duration = Date.now() - start;
  console.log(`  Analysis of 1000 identities: ${duration}ms`);
  console.log(`  Target: <60s (${duration < 60000 ? 'PASS' : 'FAIL'})\n`);

  // Cleanup
  await clearTestData();
}

loadTest();
```

---

## 4. Migration Helpers

### Compare Analyzer Outputs

```typescript
// scripts/compareAnalyzers.ts

async function compareAnalyzers(tenantId: string, dataSourceId: string) {
  const client = new ConvexHttpClient(process.env.CONVEX_URL!);

  console.log('Running both analyzers for comparison...\n');

  // Run old analyzers
  console.log('Running legacy analyzers...');
  const legacyStart = Date.now();

  const legacyMFA = new Microsoft365IdentitySecurityAnalyzer(client);
  const legacyPolicy = new Microsoft365PolicyAnalyzer(client);
  const legacyLicense = new Microsoft365LicenseAnalyzer(client);
  const legacyStale = new Microsoft365StaleUserAnalyzer(client);

  const legacyFindings = await runLegacyAnalyzers(
    [legacyMFA, legacyPolicy, legacyLicense, legacyStale],
    { tenantId, dataSourceId, syncId: 'compare_legacy' }
  );

  const legacyTime = Date.now() - legacyStart;
  console.log(`  Legacy: ${legacyTime}ms, ${legacyFindings.length} findings\n`);

  // Run unified analyzer
  console.log('Running unified analyzer...');
  const unifiedStart = Date.now();

  const unified = new UnifiedAnalyzer(client);
  const unifiedFindings = await runUnifiedAnalyzer(unified, {
    tenantId,
    dataSourceId,
    syncId: 'compare_unified',
  });

  const unifiedTime = Date.now() - unifiedStart;
  console.log(`  Unified: ${unifiedTime}ms, ${unifiedFindings.length} findings\n`);

  // Compare
  console.log('=== Comparison Results ===\n');
  console.log(`Performance: ${legacyTime}ms → ${unifiedTime}ms (${((legacyTime / unifiedTime) * 100).toFixed(1)}% faster)`);
  console.log(`Findings: ${legacyFindings.length} → ${unifiedFindings.length}`);

  // Compare by type
  const legacyCounts = countByType(legacyFindings);
  const unifiedCounts = countByType(unifiedFindings);

  console.log('\nFindings by type:');
  const allTypes = new Set([
    ...Object.keys(legacyCounts),
    ...Object.keys(unifiedCounts),
  ]);

  for (const type of allTypes) {
    const legacy = legacyCounts[type] || 0;
    const unified = unifiedCounts[type] || 0;
    const match = legacy === unified ? '✅' : '❌';
    console.log(`  ${match} ${type}: ${legacy} → ${unified}`);
  }

  // Detailed differences
  if (JSON.stringify(legacyCounts) !== JSON.stringify(unifiedCounts)) {
    console.log('\n⚠️  Differences detected! Investigating...\n');

    const missing = findMissingFindings(legacyFindings, unifiedFindings);
    const extra = findMissingFindings(unifiedFindings, legacyFindings);

    if (missing.length > 0) {
      console.log(`Missing findings (in legacy but not unified):`);
      for (const finding of missing) {
        console.log(`  - ${finding.alertType} for ${finding.entityId}`);
      }
    }

    if (extra.length > 0) {
      console.log(`\nExtra findings (in unified but not legacy):`);
      for (const finding of extra) {
        console.log(`  + ${finding.alertType} for ${finding.entityId}`);
      }
    }
  } else {
    console.log('\n✅ Outputs match perfectly!\n');
  }
}

function countByType(findings: any[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const finding of findings) {
    counts[finding.alertType] = (counts[finding.alertType] || 0) + 1;
  }
  return counts;
}

function findMissingFindings(source: any[], target: any[]): any[] {
  const targetSet = new Set(target.map((f) => `${f.entityId}:${f.alertType}`));
  return source.filter(
    (f) => !targetSet.has(`${f.entityId}:${f.alertType}`)
  );
}

// Usage: ts-node scripts/compareAnalyzers.ts <tenantId> <dataSourceId>
compareAnalyzers(process.argv[2], process.argv[3]);
```

---

## 5. Monitoring Dashboards

### Health Check Endpoint

```typescript
// src/api/health.ts

import express from 'express';

const router = express.Router();

router.get('/health', async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    components: {
      redis: await checkRedis(),
      database: await checkDatabase(),
      nats: await checkNATS(),
      queue: await checkQueue(),
    },
    metrics: {
      queueDepth: await getQueueDepth(),
      activeJobs: await getActiveJobs(),
      errorRate: await getErrorRate(),
    },
  };

  const allHealthy = Object.values(health.components).every((c) => c.healthy);
  res.status(allHealthy ? 200 : 503).json(health);
});

async function checkRedis(): Promise<{ healthy: boolean; latency?: number }> {
  try {
    const start = Date.now();
    const pong = await RedisManager.ping();
    const latency = Date.now() - start;
    return { healthy: pong, latency };
  } catch (error) {
    return { healthy: false };
  }
}

export default router;
```

---

## 6. Quick Commands

Add to `package.json`:

```json
{
  "scripts": {
    "view-trace": "ts-node scripts/viewTrace.ts",
    "view-alert-history": "ts-node scripts/viewAlertHistory.ts",
    "compare-analyzers": "ts-node scripts/compareAnalyzers.ts",
    "loadtest": "ts-node scripts/loadTest.ts",
    "benchmark": "ts-node scripts/benchmarkQueries.ts",
    "migrate:indexes": "ts-node scripts/migrateIndexes.ts"
  }
}
```

---

## 7. Common Issues & Solutions

### Issue: Redis Connection Timeout

```typescript
// Solution: Increase connection timeout
const redis = new IORedis({
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT || '6379'),
  connectTimeout: 10000, // 10 seconds
  retryStrategy: (times) => Math.min(times * 100, 3000),
});
```

### Issue: Convex Rate Limiting

```typescript
// Solution: Batch operations
async function batchInsert<T>(records: T[], batchSize = 100): Promise<void> {
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    await Promise.all(
      batch.map((record) =>
        client.mutation(api.helpers.orm.insert_s, {
          tableName: 'entities',
          record,
        })
      )
    );
    // Small delay between batches
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}
```

### Issue: Memory Leaks in Long-Running Workers

```typescript
// Solution: Periodic cleanup
setInterval(() => {
  // Clear caches
  entityCache.clear();
  relationshipCache.clear();

  // Force garbage collection (if --expose-gc flag)
  if (global.gc) {
    global.gc();
  }
}, 3600000); // Every hour
```

---

[← Back to Index](./REFACTOR_INDEX.md)
