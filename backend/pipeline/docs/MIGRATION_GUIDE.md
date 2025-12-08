# Migration Guide: New Pipeline Architecture

This guide covers the complete migration from the old backend architecture to the new refactored pipeline system (Phases 1-7).

## Table of Contents

1. [Overview](#overview)
2. [Pre-Migration Checklist](#pre-migration-checklist)
3. [Feature Flags Configuration](#feature-flags-configuration)
4. [Rollout Strategy](#rollout-strategy)
5. [Monitoring & Validation](#monitoring--validation)
6. [Rollback Procedures](#rollback-procedures)
7. [Testing](#testing)
8. [Troubleshooting](#troubleshooting)
9. [FAQ](#faq)

---

## Overview

### What Changed?

The MSPByte Pipeline has been completely refactored across 7 phases:

**Phase 1: Infrastructure & Event Flow**
- Replaced direct database calls with NATS event bus
- Introduced BullMQ job queue with Redis
- Event-driven architecture for decoupling

**Phase 2: Adapters & Processors**
- Standardized data source adapters
- Unified entity processing pipeline
- Consistent error handling and retry logic

**Phase 3: Context Loading**
- Eliminated redundant queries (1400+ → 7-10 queries)
- Pre-loaded relationship maps for O(1) lookups
- Massive performance improvement in data loading

**Phase 4: Unified Analyzer**
- Consolidated individual analyzers into unified system
- Event debouncing (5-minute window)
- Single analysis pass instead of multiple

**Phase 5: Alert System Integration**
- New AlertManager for centralized alert handling
- Fixed MFA alert bug with explicit analysis types
- 80% reduction in events, 10-20x faster alerts

**Phase 6: Database Optimizations**
- Composite indexes for query performance
- Batch loading pattern (97% query reduction in linkers)
- Real-time slow query detection

**Phase 7: Migration & Deployment** (Current)
- Feature flags for safe rollout
- Comparison mode for validation
- Prometheus metrics for monitoring
- Production deployment strategy

### Performance Improvements

```
Component                 Old System      New System      Improvement
────────────────────────────────────────────────────────────────────────
Data Loading:             1400 queries    7-10 queries    99.3% reduction
Load Time:                8-12s           2-3s            60-75% faster
Linker Queries:           300-450         8-12            97% reduction
Linker Time:              2-4 min         <10s            95% faster
Alert Processing:         30-40s          <3s             90% faster
Total Pipeline:           15+ min         ~45s            95% faster
```

---

## Pre-Migration Checklist

Before beginning migration, ensure:

- [ ] All Phases 1-7 code is deployed to staging environment
- [ ] Infrastructure is running (Redis, NATS, PostgreSQL)
- [ ] Database schema includes Phase 6 composite indexes
- [ ] Environment variables are configured (see below)
- [ ] Monitoring is set up (Prometheus, logs)
- [ ] Backup of production database is recent
- [ ] Team is trained on new architecture
- [ ] Rollback plan is documented and tested

### Required Environment Variables

```bash
# Infrastructure
REDIS_URL=redis://localhost:6379
NATS_URL=nats://localhost:4222
CONVEX_API_KEY=your_key_here

# Feature Flags (Phase 7)
FEATURE_NEW_PIPELINE=true              # Master switch
FEATURE_UNIFIED_ANALYZER=true          # Use unified analyzer
FEATURE_ALERT_MANAGER=true             # Use new alert manager
FEATURE_BATCH_LOADING=true             # Use optimized batch loading
FEATURE_PERFORMANCE_MONITORING=true    # Enable perf monitoring
FEATURE_COMPARISON_MODE=false          # Enable for validation only

# Rollout Percentages (0-100)
FEATURE_NEW_PIPELINE_ROLLOUT=0         # Start at 0%, increase gradually
FEATURE_UNIFIED_ANALYZER_ROLLOUT=100
FEATURE_ALERT_MANAGER_ROLLOUT=100
FEATURE_BATCH_LOADING_ROLLOUT=100
FEATURE_PERFORMANCE_MONITORING_ROLLOUT=100
FEATURE_COMPARISON_MODE_ROLLOUT=0

# Performance Thresholds
SLOW_QUERY_THRESHOLD_MS=100
MAX_DEBOUNCE_WINDOW_MS=300000          # 5 minutes
```

---

## Feature Flags Configuration

### Understanding Feature Flags

The new system uses feature flags to enable safe, gradual rollout:

1. **Global Flags**: Enable/disable features for all tenants
2. **Rollout Percentage**: Enable for X% of tenants (deterministic hashing)
3. **Tenant Overrides**: Force enable/disable for specific tenants

### Flag Hierarchy

```
Tenant Override (highest priority)
  ↓
Rollout Percentage
  ↓
Global Flag (lowest priority)
```

### Available Flags

**`new_pipeline`** (Master Switch)
- Controls entire new pipeline architecture
- When disabled, falls back to old system (if available)
- Recommended: Start at 0%, increase gradually

**`unified_analyzer`**
- Controls unified analysis system (Phase 4)
- When disabled, uses individual analyzers
- Recommended: 100% once new_pipeline is enabled

**`alert_manager`**
- Controls new alert manager (Phase 5)
- When disabled, uses old alert system
- Recommended: 100% once new_pipeline is enabled

**`batch_loading`**
- Controls optimized batch loading in linkers (Phase 6)
- When disabled, uses N+1 query pattern
- Recommended: 100% (massive performance gain)

**`performance_monitoring`**
- Controls query performance tracking (Phase 6)
- When disabled, no metrics collection
- Recommended: 100% (no performance impact)

**`comparison_mode`**
- Runs both old and new pipelines, compares results
- Use ONLY for validation, never in production
- Recommended: Enable per-tenant for testing only

### Setting Flags Programmatically

```typescript
import { FeatureFlagManager } from './lib/featureFlags.js';

const flags = FeatureFlagManager.getInstance();

// Enable for specific tenant
flags.setTenantOverride('new_pipeline', tenantId, true);

// Adjust rollout percentage
flags.setRolloutPercentage('new_pipeline', 25); // 25% of tenants

// Disable globally
flags.setGlobalFlag('new_pipeline', false);

// Check status
const status = flags.getStatus('new_pipeline', tenantId);
console.log(status.effectiveForTenant); // true/false
```

---

## Rollout Strategy

### Recommended Phased Rollout

**Week 1: Internal Testing (0% rollout)**
```bash
FEATURE_NEW_PIPELINE=true
FEATURE_NEW_PIPELINE_ROLLOUT=0
```
- Enable for 1-2 internal test tenants using tenant overrides
- Run comparison mode to validate results
- Monitor metrics and logs closely
- Fix any critical issues

**Week 2: Pilot (1% rollout)**
```bash
FEATURE_NEW_PIPELINE_ROLLOUT=1
```
- Enable for 1% of production tenants
- Monitor for 3-5 days
- Validate performance improvements
- Collect feedback

**Week 3: Gradual Increase (5% → 25% → 50%)**
```bash
# Day 1-2: 5%
FEATURE_NEW_PIPELINE_ROLLOUT=5

# Day 3-5: 25%
FEATURE_NEW_PIPELINE_ROLLOUT=25

# Day 6-7: 50%
FEATURE_NEW_PIPELINE_ROLLOUT=50
```
- Increase rollout every 2-3 days
- Monitor error rates and performance
- Address any issues before continuing

**Week 4: Full Rollout (100%)**
```bash
FEATURE_NEW_PIPELINE_ROLLOUT=100
```
- Enable for all tenants
- Monitor for 1 week
- Confirm all metrics are healthy
- Plan old system deprecation

### Tenant Override Strategy

For high-value or sensitive tenants:

```typescript
// Force enable for beta testers
flags.setTenantOverride('new_pipeline', 'tenant_abc', true);

// Keep VIP customers on old system initially
flags.setTenantOverride('new_pipeline', 'tenant_vip', false);
```

---

## Monitoring & Validation

### Prometheus Metrics Endpoint

The new system exposes metrics at `/metrics` (configure your endpoint):

```bash
# Example metrics
mspbyte_pipeline_executions_total{status="success"} 1234
mspbyte_pipeline_duration_ms 42500
mspbyte_queries_total 8420
mspbyte_slow_queries_total 12
mspbyte_alerts_total{action="created"} 567
```

### Key Metrics to Monitor

**Success Rate**
```promql
rate(mspbyte_pipeline_executions_total{status="success"}[5m])
/
rate(mspbyte_pipeline_executions_total[5m])
```
Target: >99.5%

**Pipeline Duration**
```promql
mspbyte_pipeline_duration_ms
```
Target: <60,000ms (1 minute)

**Query Performance**
```promql
mspbyte_slow_queries_total
```
Target: <1% of total queries

**Alert Processing**
```promql
rate(mspbyte_alerts_total{action="created"}[5m])
```
Monitor for anomalies

### Logging

Key log messages to watch:

```
✓ SUCCESS: "Pipeline execution completed"
⚠ WARNING: "Slow query detected"
❌ ERROR: "Pipeline execution failed"
```

Filter logs by module:
- `DataContextLoader`: Query performance
- `UnifiedAnalyzer`: Analysis execution
- `AlertManager`: Alert processing
- `Microsoft365Linker`: Relationship linking

### Comparison Mode Validation

For testing, enable comparison mode:

```typescript
import ComparisonMode from './migration/ComparisonMode.js';

const comparison = new ComparisonMode();
const result = await comparison.compare(tenantId, dataSourceId);

if (result.hasDiscrepancies) {
  console.log(result.report);
  // Investigate differences
}
```

---

## Rollback Procedures

### Emergency Rollback (Immediate)

If critical issues are discovered:

**Option 1: Disable Globally**
```bash
# Set in environment or runtime
FEATURE_NEW_PIPELINE=false
```
- Takes effect immediately
- All tenants revert to old system

**Option 2: Reduce Rollout**
```bash
# Reduce to 0%
FEATURE_NEW_PIPELINE_ROLLOUT=0
```
- Existing sessions continue on new system
- New sessions use old system

**Option 3: Tenant-Specific Rollback**
```typescript
// Disable for specific tenant
flags.setTenantOverride('new_pipeline', tenantId, false);
```

### Partial Rollback (Individual Features)

If specific features have issues:

```bash
# Disable only batch loading
FEATURE_BATCH_LOADING=false

# Disable only alert manager
FEATURE_ALERT_MANAGER=false
```

### Post-Rollback Actions

1. **Investigate Root Cause**: Check logs, metrics, error traces
2. **Fix Issues**: Apply patches or hotfixes
3. **Test in Staging**: Validate fixes before re-enabling
4. **Gradual Re-Rollout**: Start at low percentage again

---

## Testing

### Unit Tests

```bash
cd backend/pipeline
bun test
```

### Integration Tests

```bash
# Phase 5 (Alert System)
bun run src/test-phase5.ts

# Phase 6 (DB Optimizations)
bun run src/test-phase6.ts

# Phase 7 (Full Pipeline)
bun run src/test-phase7.ts
```

### Manual Testing Checklist

- [ ] Trigger sync for Microsoft 365 data source
- [ ] Verify entities are created/updated correctly
- [ ] Confirm relationships are linked properly
- [ ] Check that alerts are generated appropriately
- [ ] Validate alert resolution when issues are fixed
- [ ] Test with various data source types
- [ ] Verify performance improvements in logs
- [ ] Check Prometheus metrics are updating

### Load Testing

For high-volume tenants, test with realistic data:

```typescript
// Simulate large dataset
const tenantId = 'high_volume_tenant';
const dataSourceId = 'data_source_id';

// Trigger sync
await triggerSync(tenantId, dataSourceId);

// Monitor metrics
const metrics = MetricsCollector.getInstance();
const summary = metrics.getSummary();

console.log(`Queries: ${summary.totalQueries}`);
console.log(`Duration: ${summary.averagePipelineDurationMs}ms`);
console.log(`Slow queries: ${summary.slowQueryCount}`);
```

---

## Troubleshooting

### Issue: Pipeline Not Running

**Symptoms**: No jobs being processed, no events in logs

**Diagnosis**:
1. Check feature flag: `flags.getStatus('new_pipeline', tenantId)`
2. Verify infrastructure: Redis and NATS running
3. Check job queue: `bull-board` dashboard

**Solution**:
```bash
# Verify infrastructure
docker ps | grep redis
docker ps | grep nats

# Check feature flag
flags.getStatus('new_pipeline', tenantId)
```

### Issue: Slow Performance

**Symptoms**: Pipeline taking >2 minutes, many slow queries

**Diagnosis**:
1. Check if batch loading is enabled
2. Review slow query logs
3. Verify composite indexes exist

**Solution**:
```bash
# Enable batch loading
FEATURE_BATCH_LOADING=true

# Check metrics
metrics.getSummary().slowQueryCount
```

### Issue: Alerts Not Resolving

**Symptoms**: Alerts remain active after issues are fixed

**Diagnosis**:
1. Check if AlertManager is enabled
2. Verify analysisTypes array is populated
3. Review alert resolution logic

**Solution**:
```typescript
// Ensure analysisTypes is explicit in events
{
  analysisTypes: ['mfa', 'policy', 'license', 'stale'],
  findings: { mfa: [] }  // Empty = analysis ran, no issues
}
```

### Issue: Discrepancies in Comparison Mode

**Symptoms**: Comparison mode shows differences between old and new

**Diagnosis**:
1. Review comparison report details
2. Check if differences are expected (e.g., performance vs. functionality)
3. Validate against known data

**Solution**:
- If critical discrepancies: Investigate and fix before rollout
- If minor differences: Document and accept if intentional

---

## FAQ

**Q: Can I run old and new pipelines simultaneously?**

A: Yes, with comparison mode enabled. However, this doubles resource usage and should only be used for validation, not production.

**Q: What happens if I disable a flag mid-execution?**

A: The currently running pipeline will complete using the original configuration. New jobs will use the updated flag settings.

**Q: How do I know if the new pipeline is faster?**

A: Check Prometheus metrics. Compare `mspbyte_pipeline_duration_ms` before and after. Expected improvement: 75-95% faster.

**Q: Can I rollback individual features?**

A: Yes! Each phase has its own feature flag. You can disable specific features while keeping others enabled.

**Q: What if Redis or NATS goes down?**

A: The pipeline will fail gracefully and retry. Jobs remain in queue until infrastructure recovers. Consider setting up Redis persistence and NATS clustering for production.

**Q: How do I migrate existing data?**

A: No data migration needed! The new pipeline uses the same database schema. Phase 6 added indexes (non-breaking change).

**Q: Should I delete the old code?**

A: Not immediately. Keep old code until 100% rollout is stable for 2+ weeks. Then archive and remove.

**Q: How do I handle multi-tenant issues?**

A: Use tenant overrides to disable new pipeline for affected tenants while you investigate and fix.

---

## Architecture Diagrams

### Old System (Before)

```
Scheduled Job Trigger
  ↓
Direct DB Queries (1400+)
  ↓
Individual Analyzers (4x redundant queries)
  ↓
Alert Creation (30-40s)
──────────────────────────
Total: 15+ minutes
```

### New System (After)

```
Event Trigger (NATS)
  ↓
DataContextLoader (7-10 queries, parallel)
  ↓
UnifiedAnalyzer (single pass, debounced)
  ↓
AlertManager (<3s)
──────────────────────────
Total: ~45 seconds
```

---

## Support

For issues during migration:

1. **Check Logs**: `backend/pipeline/logs`
2. **Review Metrics**: Prometheus dashboard
3. **Feature Flags**: Adjust rollout as needed
4. **Rollback**: Use emergency procedures if critical

**Emergency Contacts**:
- Infrastructure Team: infra@example.com
- Backend Team: backend@example.com
- On-Call: oncall@example.com

---

## Appendix: Complete Environment Variables

```bash
# ============================================================================
# INFRASTRUCTURE
# ============================================================================
REDIS_URL=redis://localhost:6379
NATS_URL=nats://localhost:4222
CONVEX_API_KEY=your_convex_api_key

# ============================================================================
# FEATURE FLAGS - PHASE 7
# ============================================================================

# Master switch for new pipeline
FEATURE_NEW_PIPELINE=true
FEATURE_NEW_PIPELINE_ROLLOUT=100

# Unified analyzer (Phase 4)
FEATURE_UNIFIED_ANALYZER=true
FEATURE_UNIFIED_ANALYZER_ROLLOUT=100

# Alert manager (Phase 5)
FEATURE_ALERT_MANAGER=true
FEATURE_ALERT_MANAGER_ROLLOUT=100

# Batch loading optimization (Phase 6)
FEATURE_BATCH_LOADING=true
FEATURE_BATCH_LOADING_ROLLOUT=100

# Performance monitoring (Phase 6)
FEATURE_PERFORMANCE_MONITORING=true
FEATURE_PERFORMANCE_MONITORING_ROLLOUT=100

# Comparison mode (Phase 7 - testing only)
FEATURE_COMPARISON_MODE=false
FEATURE_COMPARISON_MODE_ROLLOUT=0

# ============================================================================
# PERFORMANCE TUNING
# ============================================================================
SLOW_QUERY_THRESHOLD_MS=100
MAX_DEBOUNCE_WINDOW_MS=300000
MAX_CONCURRENT_JOBS=5
JOB_TIMEOUT_MS=600000

# ============================================================================
# LOGGING & MONITORING
# ============================================================================
LOG_LEVEL=info
METRICS_PORT=9090
ENABLE_PROMETHEUS=true
```

---

**Version**: 1.0.0
**Last Updated**: 2025-12-07
**Phases Covered**: 1-7 (Complete Pipeline Refactor)
