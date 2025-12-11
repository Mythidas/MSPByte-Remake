# Phase 7: Migration & Deployment

[← Back to Index](./REFACTOR_INDEX.md) | [← Previous: Database Optimizations](./06_DATABASE_OPTIMIZATIONS.md)

---

## Overview

**Goal**: Safely migrate from old system to new architecture

**Strategy**: Gradual rollout with parallel running and feature flags

---

## Migration Checklist

### Pre-Migration

- [ ] All phases 1-6 completed and tested
- [ ] Backup of production database taken
- [ ] Redis infrastructure provisioned and tested
- [ ] Rollback plan documented and tested
- [ ] Monitoring and alerts configured
- [ ] Load testing completed

### Migration Phases

- [ ] Week 1: Deploy to staging, parallel run
- [ ] Week 2: Enable for 1 test tenant in production
- [ ] Week 3: Enable for 10% of tenants
- [ ] Week 4: Enable for 50% of tenants
- [ ] Week 5: Enable for all tenants
- [ ] Week 6: Deprecate old system
- [ ] Week 7: Remove old code

---

## Feature Flags Configuration

### Environment Variables

```bash
# .env.production

# Phase 1: BullMQ Queue
USE_BULLMQ=true
BULLMQ_TENANTS=  # Empty = all tenants

# Phase 4: Unified Analyzer
USE_UNIFIED_ANALYZER=true
UNIFIED_ANALYZER_TENANTS=  # Empty = all tenants

# Comparison mode (run both, compare outputs)
COMPARE_ANALYZERS=false  # Set to true for validation
```

### Gradual Tenant Migration

```typescript
// src/lib/tenantMigration.ts

interface MigrationConfig {
  bullmqEnabled: boolean;
  unifiedAnalyzerEnabled: boolean;
  tenantIds: Set<string>;
  percentage: number; // 0-100
}

class TenantMigration {
  private static config: MigrationConfig;

  static initialize(): void {
    const tenantList = (process.env.BULLMQ_TENANTS || "")
      .split(",")
      .filter(Boolean);
    const percentage = parseInt(process.env.MIGRATION_PERCENTAGE || "0");

    this.config = {
      bullmqEnabled: process.env.USE_BULLMQ === "true",
      unifiedAnalyzerEnabled: process.env.USE_UNIFIED_ANALYZER === "true",
      tenantIds: new Set(tenantList),
      percentage,
    };
  }

  static shouldUseBullMQ(tenantId: string): boolean {
    if (!this.config.bullmqEnabled) {
      return false;
    }

    // Explicit tenant list takes precedence
    if (this.config.tenantIds.size > 0) {
      return this.config.tenantIds.has(tenantId);
    }

    // Percentage-based rollout
    if (this.config.percentage > 0) {
      return this.isInPercentage(tenantId, this.config.percentage);
    }

    return true; // All tenants
  }

  static shouldUseUnifiedAnalyzer(tenantId: string): boolean {
    // Same logic as BullMQ
    return this.shouldUseBullMQ(tenantId);
  }

  private static isInPercentage(tenantId: string, percentage: number): boolean {
    // Consistent hash-based selection
    const hash = this.hashString(tenantId);
    return hash % 100 < percentage;
  }

  private static hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }

  static getStats(): {
    bullmqTenants: number;
    legacyTenants: number;
    percentage: number;
  } {
    // Query all tenants and count
    // Implementation depends on how you track tenants
    return {
      bullmqTenants: 0,
      legacyTenants: 0,
      percentage: this.config.percentage,
    };
  }
}

export default TenantMigration;
```

---

## Parallel Running Strategy

### Dual-Path Execution

```typescript
// src/index.ts

async function main() {
  const client = new ConvexHttpClient(process.env.CONVEX_URL!);
  await NatsClient.connect();

  TenantMigration.initialize();

  // Initialize BOTH systems during migration
  const queueManager = new QueueManager(client, NatsClient);
  const legacyScheduler = new Scheduler(client, NatsClient);

  const unifiedAnalyzer = new UnifiedAnalyzer(client);
  const legacyAnalyzers = [
    new Microsoft365IdentitySecurityAnalyzer(client),
    new Microsoft365PolicyAnalyzer(client),
    new Microsoft365LicenseAnalyzer(client),
    new Microsoft365StaleUserAnalyzer(client),
  ];

  // Comparison mode: Run both, compare outputs
  if (process.env.COMPARE_ANALYZERS === "true") {
    await setupComparisonMode(unifiedAnalyzer, legacyAnalyzers);
  }

  await queueManager.initialize();
  await legacyScheduler.initialize();
  await unifiedAnalyzer.initialize();
  for (const analyzer of legacyAnalyzers) {
    await analyzer.initialize();
  }

  Logger.log({
    module: "Main",
    context: "startup",
    message: "Pipeline started in migration mode",
    metadata: {
      bullmqEnabled: process.env.USE_BULLMQ,
      unifiedAnalyzerEnabled: process.env.USE_UNIFIED_ANALYZER,
      comparisonMode: process.env.COMPARE_ANALYZERS,
    },
  });
}
```

### Comparison Mode

```typescript
async function setupComparisonMode(
  unifiedAnalyzer: UnifiedAnalyzer,
  legacyAnalyzers: any[],
): Promise<void> {
  // Intercept analysis events
  await NatsClient.subscribe("linked.>", async (event) => {
    Logger.log({
      module: "ComparisonMode",
      context: "intercept",
      message: "Running both analyzers for comparison",
    });

    // Run both in parallel
    const [unifiedResults, legacyResults] = await Promise.all([
      captureUnifiedAnalysis(unifiedAnalyzer, event),
      captureLegacyAnalysis(legacyAnalyzers, event),
    ]);

    // Compare results
    const comparison = compareFindings(unifiedResults, legacyResults);

    if (!comparison.match) {
      Logger.log({
        module: "ComparisonMode",
        context: "mismatch",
        message: "Findings mismatch detected!",
        level: "warn",
        metadata: {
          unified: unifiedResults,
          legacy: legacyResults,
          differences: comparison.differences,
        },
      });

      // Alert ops team about mismatch
      await alertOpsteam({
        subject: "Analyzer Comparison Mismatch",
        details: comparison,
      });
    }
  });
}

function compareFindings(
  unified: any[],
  legacy: any[],
): {
  match: boolean;
  differences: string[];
} {
  const differences: string[] = [];

  // Compare counts by alert type
  const unifiedCounts = countByType(unified);
  const legacyCounts = countByType(legacy);

  for (const [type, count] of Object.entries(unifiedCounts)) {
    const legacyCount = legacyCounts[type] || 0;
    if (count !== legacyCount) {
      differences.push(`${type}: unified=${count}, legacy=${legacyCount}`);
    }
  }

  return {
    match: differences.length === 0,
    differences,
  };
}
```

---

## Deployment Steps

### Week 1: Staging Deployment

```bash
# Deploy to staging
git checkout main
git pull

# Enable all new features in staging
export USE_BULLMQ=true
export USE_UNIFIED_ANALYZER=true
export COMPARE_ANALYZERS=true

# Deploy
npm run deploy:staging

# Monitor logs for 48 hours
npm run logs:staging -- --follow

# Run load tests
npm run loadtest:staging
```

**Success Criteria**:

- No errors in logs
- Comparison mode shows 100% match
- Performance meets targets (<60s analysis)
- Load test passes

### Week 2: Production - Test Tenant

```bash
# Deploy to production (both systems active)
export USE_BULLMQ=true
export USE_UNIFIED_ANALYZER=true
export BULLMQ_TENANTS=test_tenant_id_here
export UNIFIED_ANALYZER_TENANTS=test_tenant_id_here

npm run deploy:production

# Monitor test tenant closely
npm run logs:production -- --filter tenantId=test_tenant_id
```

**Success Criteria**:

- Test tenant working normally
- No customer complaints
- Alerts accurate
- Performance improved

### Week 3: 10% of Tenants

```bash
# Percentage-based rollout
export USE_BULLMQ=true
export USE_UNIFIED_ANALYZER=true
export MIGRATION_PERCENTAGE=10
export BULLMQ_TENANTS=  # Clear specific list

npm run deploy:production
```

**Monitor**:

- Error rates
- Performance metrics
- Customer support tickets
- Alert accuracy

### Week 4: 50% of Tenants

```bash
export MIGRATION_PERCENTAGE=50
npm run deploy:production
```

### Week 5: 100% of Tenants

```bash
export MIGRATION_PERCENTAGE=100
npm run deploy:production

# Or simply:
export USE_BULLMQ=true
export USE_UNIFIED_ANALYZER=true
export BULLMQ_TENANTS=
export MIGRATION_PERCENTAGE=

npm run deploy:production
```

### Week 6: Deprecate Old System

```bash
# Disable old scheduler and analyzers
# (Keep code for rollback)

# Update main.ts
if (USE_BULLMQ) {
  // Only initialize new system
  await queueManager.initialize();
  await unifiedAnalyzer.initialize();
}
// Remove old scheduler/analyzer initialization

npm run deploy:production
```

### Week 7: Remove Old Code

```bash
# Delete old files
rm src/scheduler/index.ts
rm src/workers/Microsoft365IdentitySecurityAnalyzer.ts
rm src/workers/Microsoft365PolicyAnalyzer.ts
rm src/workers/Microsoft365LicenseAnalyzer.ts
rm src/workers/Microsoft365StaleUserAnalyzer.ts
rm src/workers/BaseWorker.ts

# Update imports
# Commit and deploy

git add .
git commit -m "refactor: remove legacy scheduler and workers"
git push
npm run deploy:production
```

---

## Rollback Procedures

### Rollback Triggers

Rollback if:

- Error rate increases >10%
- Customer complaints increase
- Performance degrades
- Data accuracy issues
- Redis infrastructure failure

### Immediate Rollback (Emergency)

```bash
# Set env vars to disable new system
export USE_BULLMQ=false
export USE_UNIFIED_ANALYZER=false

# Restart application
pm2 restart mspbyte-pipeline

# Or redeploy
npm run deploy:production
```

**Recovery Time**: < 5 minutes

### Gradual Rollback

```bash
# Reduce percentage
export MIGRATION_PERCENTAGE=25  # Was 50%

# Or specify tenants to keep
export BULLMQ_TENANTS=tenant1,tenant2  # Only working tenants

npm run deploy:production
```

### Post-Rollback

1. **Investigate**: Review logs, metrics, errors
2. **Fix**: Address root cause
3. **Test**: Validate fix in staging
4. **Retry**: Resume migration when ready

---

## Monitoring & Alerts

### Key Metrics to Track

```typescript
// Prometheus metrics (if using)
const metrics = {
  // Queue metrics
  queue_depth: new Gauge({ name: "pipeline_queue_depth" }),
  queue_latency: new Histogram({ name: "pipeline_queue_latency_seconds" }),

  // Analysis metrics
  analysis_duration: new Histogram({
    name: "pipeline_analysis_duration_seconds",
    labelNames: ["analyzer_type"],
  }),
  findings_count: new Counter({
    name: "pipeline_findings_total",
    labelNames: ["alert_type", "severity"],
  }),

  // Error metrics
  errors_total: new Counter({
    name: "pipeline_errors_total",
    labelNames: ["module", "error_type"],
  }),

  // Database metrics
  query_duration: new Histogram({
    name: "pipeline_query_duration_seconds",
    labelNames: ["table", "operation"],
  }),
};
```

### Alert Rules

```yaml
# Example Prometheus alert rules

groups:
  - name: pipeline
    rules:
      - alert: HighQueueDepth
        expr: pipeline_queue_depth > 1000
        for: 5m
        annotations:
          summary: "Queue depth is high"

      - alert: SlowAnalysis
        expr: histogram_quantile(0.95, pipeline_analysis_duration_seconds) > 120
        for: 10m
        annotations:
          summary: "Analysis taking >2 minutes for 95th percentile"

      - alert: HighErrorRate
        expr: rate(pipeline_errors_total[5m]) > 0.1
        for: 5m
        annotations:
          summary: "Error rate >0.1/sec"

      - alert: RedisDown
        expr: up{job="redis"} == 0
        for: 1m
        annotations:
          summary: "Redis is down - pipeline will degrade"
```

---

## Post-Migration Validation

### Validation Checklist

- [ ] All tenants migrated successfully
- [ ] Error rate back to baseline
- [ ] Performance improved (verify <60s analysis)
- [ ] Alert accuracy maintained
- [ ] Customer satisfaction unchanged/improved
- [ ] Database query count reduced >90%
- [ ] Redis stable and performing well

### Performance Validation

```bash
# Run benchmarks
npm run benchmark

# Expected results:
# - Job latency: <1s (was 30-60s)
# - Analysis time: <60s (was 15+ min)
# - DB queries: <10 per analysis (was 800+)
# - No slow queries >1s
```

### Data Validation

```typescript
// Verify alert counts match
async function validateAlertCounts() {
  const before = await getHistoricalAlertCounts(); // From logs
  const after = await getCurrentAlertCounts();

  for (const [type, count] of Object.entries(after)) {
    const previousCount = before[type] || 0;
    const delta = Math.abs(count - previousCount) / previousCount;

    if (delta > 0.1) {
      // >10% change
      console.warn(
        `Alert count changed significantly for ${type}: ${previousCount} → ${count}`,
      );
    }
  }
}
```

---

## Success Criteria

- [ ] All tenants on new system
- [ ] Old code removed
- [ ] Performance targets met
- [ ] Zero data loss during migration
- [ ] Customer satisfaction maintained
- [ ] Team can operate and debug new system
- [ ] Documentation complete

---

## Lessons Learned Template

After migration, document:

### What Went Well

- ...

### What Didn't Go Well

- ...

### Unexpected Issues

- ...

### Improvements for Next Time

- ...

---

**Migration Complete!**

Return to [REFACTOR_INDEX.md](./REFACTOR_INDEX.md) for overview.

See [APPENDIX_CODE_EXAMPLES.md](./APPENDIX_CODE_EXAMPLES.md) for additional utilities and helpers.
