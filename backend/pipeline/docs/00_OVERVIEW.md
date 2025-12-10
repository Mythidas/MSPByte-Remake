# Phase 0: Overview & Current State Analysis

[← Back to Index](./REFACTOR_INDEX.md)

---

## Current Architecture Deep Dive

### System Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. SCHEDULING (Scheduler)                                       │
│    Location: src/scheduler/index.ts                             │
│    ┌──────────────────────────────────────────────────────┐    │
│    │ setInterval(pollJobs, 60000)  // Poll every 60s      │    │
│    │   ↓                                                   │    │
│    │ Query scheduled_jobs table (ALL pending + failed)    │    │
│    │   ↓                                                   │    │
│    │ Filter for due jobs + check tenant concurrency       │    │
│    │   ↓                                                   │    │
│    │ Mark as "running" + publish to NATS                  │    │
│    └──────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. SYNC (Adapters)                                              │
│    Location: src/adapters/microsoft-365/*                       │
│    ┌──────────────────────────────────────────────────────┐    │
│    │ Subscribe: "microsoft-365.sync.identities"           │    │
│    │   ↓                                                   │    │
│    │ Call Microsoft Graph API (paginated)                 │    │
│    │   ↓                                                   │    │
│    │ Publish: "fetched.identities" (per batch)            │    │
│    │   ↓                                                   │    │
│    │ If hasNextPage: schedule next batch job              │    │
│    └──────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. PROCESS (Processors)                                         │
│    Location: src/processors/Microsoft365Processor.ts            │
│    ┌──────────────────────────────────────────────────────┐    │
│    │ Subscribe: "fetched.identities"                      │    │
│    │   ↓                                                   │    │
│    │ Normalize data to standard schema                    │    │
│    │   ↓                                                   │    │
│    │ Store in entities table                              │    │
│    │   ↓                                                   │    │
│    │ Publish: "processed.identities"                      │    │
│    └──────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 4. LINK (Linkers)                                               │
│    Location: src/linkers/Microsoft365Linker.ts                  │
│    ┌──────────────────────────────────────────────────────┐    │
│    │ Subscribe: "processed.*"                             │    │
│    │   ↓                                                   │    │
│    │ For each entity (groups, roles):                     │    │
│    │   - Call API for members/assignments                 │    │
│    │   - Query existing relationships (N+1 pattern!)      │    │
│    │   - Create entity_relationships records              │    │
│    │   ↓                                                   │    │
│    │ Publish: "linked.identities"                         │    │
│    └──────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 5. ANALYZE (Workers) - THIS IS WHERE PROBLEMS ARE!              │
│    Location: src/workers/*                                      │
│                                                                  │
│    ┌──────────────────────── WORKER 1 ──────────────────────┐  │
│    │ Microsoft365IdentitySecurityAnalyzer (MFA)            │  │
│    │ Subscribe: "linked.identities", "linked.policies"     │  │
│    │ Debounce: 5 minutes                                   │  │
│    │ ┌────────────────────────────────────────────────┐    │  │
│    │ │ 1. Query ALL identities                        │    │  │
│    │ │ 2. Query ALL policies                          │    │  │
│    │ │ 3. Query ALL groups                            │◄───┼──┼─ REDUNDANT!
│    │ │ 4. Query ALL group memberships                 │    │  │
│    │ │ 5. Build group membership map                  │    │  │
│    │ │ 6. Analyze MFA coverage                        │    │  │
│    │ │ 7. Emit to AlertManager                        │    │  │
│    │ │ 8. Emit to TagManager                          │    │  │
│    │ └────────────────────────────────────────────────┘    │  │
│    └───────────────────────────────────────────────────────┘  │
│                                                                  │
│    ┌──────────────────────── WORKER 2 ──────────────────────┐  │
│    │ Microsoft365PolicyAnalyzer                            │  │
│    │ Subscribe: "linked.identities", "linked.policies"     │  │
│    │ ┌────────────────────────────────────────────────┐    │  │
│    │ │ 1. Query ALL identities                        │◄───┼──┼─ DUPLICATE!
│    │ │ 2. Query ALL policies                          │◄───┼──┼─ DUPLICATE!
│    │ │ 3. For EACH identity:                          │    │  │
│    │ │    - Query relationships (N+1!)                │◄───┼──┼─ N+1 QUERY!
│    │ │    - Query each group entity (N+1!)            │    │  │
│    │ │ 4. Analyze policy coverage                     │    │  │
│    │ │ 5. Emit to AlertManager                        │    │  │
│    │ └────────────────────────────────────────────────┘    │  │
│    └───────────────────────────────────────────────────────┘  │
│                                                                  │
│    ┌──────────────────────── WORKER 3 ──────────────────────┐  │
│    │ Microsoft365LicenseAnalyzer                           │  │
│    │ Subscribe: "linked.identities", "linked.licenses"     │  │
│    │ ┌────────────────────────────────────────────────┐    │  │
│    │ │ 1. Query ALL identities                        │◄───┼──┼─ DUPLICATE!
│    │ │ 2. Query ALL licenses                          │    │  │
│    │ │ 3. Analyze license waste                       │    │  │
│    │ │ 4. Emit to AlertManager                        │    │  │
│    │ │ 5. CREATE license_overuse alerts directly!     │◄───┼──┼─ INCONSISTENT!
│    │ └────────────────────────────────────────────────┘    │  │
│    └───────────────────────────────────────────────────────┘  │
│                                                                  │
│    ┌──────────────────────── WORKER 4 ──────────────────────┐  │
│    │ Microsoft365StaleUserAnalyzer                         │  │
│    │ Subscribe: "linked.identities"                        │  │
│    │ ┌────────────────────────────────────────────────┐    │  │
│    │ │ 1. Query ALL identities                        │◄───┼──┼─ DUPLICATE!
│    │ │ 2. Analyze stale users                         │    │  │
│    │ │ 3. Emit to AlertManager                        │    │  │
│    │ │ 4. Emit to TagManager                          │    │  │
│    │ └────────────────────────────────────────────────┘    │  │
│    └───────────────────────────────────────────────────────┘  │
│                                                                  │
│    ┌──────────────────────── WORKER 5 ──────────────────────┐  │
│    │ CleanupWorker (Mark & Sweep)                          │  │
│    │ Subscribe: "linked.*" (all types)                     │  │
│    │ ┌────────────────────────────────────────────────┐    │  │
│    │ │ 1. Query ALL entities of type                  │    │  │
│    │ │ 2. Mark entities with old syncId for deletion  │    │  │
│    │ │ 3. Soft delete (set deletedAt)                 │    │  │
│    │ └────────────────────────────────────────────────┘    │  │
│    └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 6. ALERT MANAGEMENT                                             │
│    Location: src/analyzers/AlertManager.ts                      │
│    ┌──────────────────────────────────────────────────────┐    │
│    │ Subscribe: "analysis.*"                              │    │
│    │ Aggregate: 30 second window                          │    │
│    │   ↓                                                   │    │
│    │ Create new alerts                                    │    │
│    │ Update existing alerts                               │    │
│    │ Resolve alerts (when findings disappear)             │    │
│    │   ↓                                                   │    │
│    │ Update identity states based on severity             │    │
│    └──────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Critical Issues Identified

### Issue 1: MFA Alert Bug (High Priority)

**File**: `src/workers/Microsoft365IdentitySecurityAnalyzer.ts` + `src/analyzers/AlertManager.ts`

**Symptom**: "No MFA" tags get cleared but alerts persist, creating confusing state

**Root Cause**:

1. MFA Analyzer emits to BOTH TagManager and AlertManager (lines 291-326)
2. When full MFA coverage achieved:
   - Analyzer emits tag findings with `tagsToRemove: ["No MFA"]` ✓
   - TagManager removes tags ✓
   - Analyzer emits NO alert findings (implicit "all good")
   - AlertManager MIGHT not run if analysis didn't trigger
3. Result: Tags cleared, alerts orphaned

**Code Evidence**:

```typescript
// Microsoft365IdentitySecurityAnalyzer.ts:291-326
// Emits findings for alerts
await this.emitAnalysis(event, "mfa", findings); // May be empty array

// Emits findings for tags
await this.emitTagAnalysis(event, "mfa", tagFindings); // Explicitly removes tags

// AlertManager.ts:308-336
// Only resolves if analysis type was included
const ownerAnalysisType = this.getAlertOwnerType(existing.alertType);
if (!includedAnalysisTypes.has(ownerAnalysisType)) {
  continue; // SKIPS resolution if MFA analysis didn't run!
}
```

**Why It Happens**:

- Identity syncs without policy sync → MFA analyzer runs with stale policy data
- Tags get updated (explicit remove) but alerts don't resolve (implicit no-findings)
- Or: MFA analyzer doesn't run at all, tags cleared by old analysis, alerts persist

**Impact**: Users see confusing alerts that don't match reality

---

### Issue 2: Redundant Data Fetching (Critical Performance)

**Files**: All workers in `src/workers/*`

**The Problem**: Each worker independently fetches the same data

**Example Timeline** (after identity sync completes):

```
T+0min:   MFA Analyzer triggers
          - Query 150 identities
          - Query 10 policies
          - Query 50 groups
          - Query 300 group memberships
          Total: 510 records fetched

T+0min:   Policy Analyzer triggers (parallel)
          - Query 150 identities (DUPLICATE!)
          - Query 10 policies (DUPLICATE!)
          - For each identity:
            * Query relationships → 150 queries (N+1!)
            * For each relationship, query group → 300 queries (N+1!)
          Total: 160 + 450 = 610 queries!

T+0min:   License Analyzer triggers (parallel)
          - Query 150 identities (DUPLICATE!)
          - Query 20 licenses
          Total: 170 records fetched

T+0min:   Stale Analyzer triggers (parallel)
          - Query 150 identities (DUPLICATE!)
          Total: 150 records fetched

GRAND TOTAL: 510 + 610 + 170 + 150 = 1440 operations
OPTIMAL:     ~10 queries (fetch each entity type once)
WASTE:       99% of operations are redundant
```

**Code Evidence**:

```typescript
// MFA Analyzer (lines 87-171)
const identitiesToAnalyze = await client.query(api.helpers.orm.list_s, {
  tableName: "entities",
  index: {
    name: "by_data_source_type",
    params: { dataSourceId, entityType: "identities" },
  },
});
const allGroups = await client.query(/* ALL groups */);
// ... fetches all group memberships

// Policy Analyzer (lines 75-168) - SAME DATA!
const identitiesToAnalyze = await client.query(/* SAME QUERY */);
for (const identity of identitiesToAnalyze) {
  const userGroups = await client.query(/* PER IDENTITY! */);
}

// License Analyzer (lines 56-88) - SAME DATA!
const identitiesToAnalyze = await client.query(/* SAME QUERY */);

// Stale Analyzer (lines 53-104) - SAME DATA!
const identitiesToAnalyze = await client.query(/* SAME QUERY */);
```

**Impact**:

- Analysis takes 15+ minutes that could take 30 seconds
- Database overload with redundant queries
- Wasted compute resources
- Poor scalability (gets worse with more data)

---

### Issue 3: Database Polling Scheduler (Architecture Flaw)

**File**: `src/scheduler/index.ts`

**The Problem**: Jobs are scheduled by polling database every 60 seconds

**Code**:

```typescript
// Line 30
this.pollInterval = 60000; // 60 seconds

// Line 181
setInterval(async () => {
    await this.pollJobs();
}, this.pollInterval);

// Line 190-310: pollJobs method
private async pollJobs(): Promise<void> {
    // Query ALL pending + ALL failed jobs
    const [pendingJobs, failedJobs] = await Promise.all([
        client.query(api.helpers.orm.list_s, {
            tableName: "scheduled_jobs",
            index: { name: "by_status", params: { status: "pending" } }
        }),
        client.query(api.helpers.orm.list_s, {
            tableName: "scheduled_jobs",
            index: { name: "by_status", params: { status: "failed" } }
        }),
    ]);

    // ... filter, sort, check concurrency, process
}
```

**Problems**:

1. **High Latency**: Jobs wait up to 60s before execution (average 30s delay)
2. **Inefficient**: Queries entire jobs table every 60s even if no jobs due
3. **Database Load**: Constant polling creates unnecessary load
4. **No Features**: Can't easily do priorities, retries, delays, dependencies
5. **Scalability**: Polling doesn't scale well with many jobs

**Impact**:

- Slow response to events (alerts delayed by up to 60s)
- Database becomes bottleneck
- Hard to implement advanced scheduling features

---

### Issue 4: N+1 Query Patterns (Performance)

**File**: `src/linkers/Microsoft365Linker.ts` + `src/workers/Microsoft365PolicyAnalyzer.ts`

**Linker Example** (lines 122-134):

```typescript
for (const group of groups) {
  // 50 groups
  // API call per group
  const { data: members } = await connector.getGroupMembers(group.externalId);

  for (const member of members) {
    // 300 total members
    // Query per member to check if relationship exists
    const existingRelationships = await client.query(api.helpers.orm.list_s, {
      tableName: "entity_relationships",
      index: { name: "by_parent", params: { parentEntityId: group._id } },
    });

    const relationshipExists = existingRelationships.some(/* check */);
    // ... create if not exists
  }
}
```

**Problem**: For 50 groups with average 6 members each = 50 API calls + 300 database queries

**Better Approach**:

```typescript
// Fetch ALL relationships upfront (1 query)
const allRelationships = await client.query(/* all group memberships */);
const existingSet = new Set(
  allRelationships.map((r) => `${r.parent}:${r.child}`),
);

for (const group of groups) {
  const { data: members } = await connector.getGroupMembers(group.externalId);
  for (const member of members) {
    if (!existingSet.has(`${group._id}:${member._id}`)) {
      // O(1) lookup instead of query
    }
  }
}
```

**Impact**: 300 queries → 1 query = 99% reduction

---

### Issue 5: Inconsistent Alert Creation (Architecture)

**File**: `src/workers/Microsoft365LicenseAnalyzer.ts`

**The Problem**: LicenseAnalyzer creates some alerts directly, bypassing AlertManager

**Code** (lines 177-241):

```typescript
// License waste alerts → Emitted to AlertManager (correct)
await this.emitAnalysis(event, "license", findings);

// BUT: License overuse alerts → Created directly (wrong!)
if (consumedUnits > totalUnits) {
  await client.mutation(api.helpers.orm.insert_s, {
    tableName: "entity_alerts",
    record: {
      entityId: license._id,
      alertType: "license_overuse",
      // ... creates alert directly, bypassing AlertManager
    },
  });
}
```

**Problems**:

1. AlertManager doesn't know about these alerts (can't aggregate)
2. No alert history tracked for license_overuse
3. Duplicate alert creation logic
4. Inconsistent with architecture (some alerts via manager, some direct)
5. Can't apply tenant preferences (future feature)

**Impact**: Harder to maintain, debug, and extend

---

### Issue 6: Poor Debugging/Observability (Operations)

**Files**: Throughout codebase

**Problems**:

1. **No Trace IDs**: Can't follow a single sync job through pipeline stages
2. **No Timing Metrics**: Don't know where time is spent
3. **Disconnected Logs**: Each worker logs independently, hard to correlate
4. **No Alert History**: Can't see when alert was created, resolved, re-opened
5. **No Error Aggregation**: Errors logged but not tracked systematically

**Example**: User reports "Alert not resolving"

```
Current debugging process:
1. Check entity_alerts table → See alert is active
2. Grep logs for entity ID → Find scattered log entries
3. Don't know: When did analysis last run? What data did it see? Why didn't it resolve?
4. Can't trace: Which sync triggered this? Did all required data syncs complete?
```

**What's Missing**:

- Trace ID linking scheduler → adapter → processor → linker → worker → alert
- Timing breakdown: "Sync took 10min, where? Fetch: 2min, Process: 1min, Link: 5min, Analyze: 2min"
- Alert state transitions: "Created 2024-12-01, Resolved 2024-12-02, Re-opened 2024-12-03"

**Impact**: Production issues hard to diagnose, slow debugging, customer support challenges

---

### Issue 7: Scheduling Mismatches (Efficiency)

**Problem**: Related data sources sync at different times, triggering redundant analysis

**Example**:

```
1:00 PM - Identities sync completes
          ↓ Triggers MFA Analyzer (uses policies from 12:00 PM - stale!)
          ↓ Triggers Policy Analyzer
          ↓ Triggers Stale Analyzer

1:05 PM - Policies sync completes
          ↓ Triggers MFA Analyzer AGAIN (now with fresh policies)
          ↓ Triggers Policy Analyzer AGAIN

1:10 PM - Groups sync completes
          ↓ Triggers MFA Analyzer AGAIN (group membership affects MFA)

Result: MFA analysis runs 3 times in 10 minutes with partially stale data
```

**Root Cause**: No coordination between related syncs

**Better Approach**:

- Batch related syncs together (identities + policies + groups)
- Or: Debounce analysis until all required data is fresh
- Or: Check data freshness before running analysis

**Impact**: Wasted compute, slower overall sync time, analyze stale data

---

## Why This Refactor Is Necessary

### Current State Assessment

**What Works**:

- ✅ Event-driven architecture (NATS pub/sub)
- ✅ BaseWorker pattern provides good abstractions
- ✅ AlertManager aggregation reduces alert noise
- ✅ Pagination handling for large datasets
- ✅ Per-tenant concurrency limits
- ✅ Recent improvements (TagManager, consolidated alert logic)

**What Doesn't Work**:

- ❌ Database polling causes high latency
- ❌ Massive data redundancy (same data fetched 4+ times)
- ❌ N+1 query patterns in multiple places
- ❌ Poor observability (can't debug production issues effectively)
- ❌ MFA alert bug creates customer confusion
- ❌ Uncoordinated syncs waste compute
- ❌ Inconsistent alert creation patterns

### The Core Problem

**Your original insight was correct**: The system pulls the same data multiple times instead of loading once and running all analysis.

This isn't just inefficient—it's architecturally limiting:

- Can't easily add new analysis types (would add more redundancy)
- Can't implement tenant alert preferences (inconsistent alert creation)
- Can't scale to larger tenants (query load grows exponentially)
- Can't debug effectively (no visibility into what's happening)

### The Solution

Transform from **"independent workers that each fetch data"** to **"unified analysis that loads data once"**:

```
OLD:
Worker1.fetchData() → analyze() → emit()
Worker2.fetchData() → analyze() → emit()  // Redundant!
Worker3.fetchData() → analyze() → emit()  // Redundant!

NEW:
DataContext.load() → {
  UnifiedAnalyzer.analyzeMFA()
  UnifiedAnalyzer.analyzePolicy()
  UnifiedAnalyzer.analyzeLicense()
  UnifiedAnalyzer.analyzeStale()
} → emit()
```

Plus:

- Replace polling with push-based queue (BullMQ)
- Add comprehensive tracing and logging
- Track alert history for debugging
- Optimize database queries and indexes

---

## Expected Benefits

### Performance Improvements

| Metric                  | Before       | After | Improvement    |
| ----------------------- | ------------ | ----- | -------------- |
| Job latency             | 30-60s       | <1s   | 30-60x         |
| DB queries per analysis | 800-1400     | 7-10  | 99%            |
| Analysis runtime        | 15+ min      | 30s   | 30x            |
| Data fetching           | 4x redundant | 1x    | 75% reduction  |
| N+1 queries             | 300+         | 0     | 100% reduction |

### Operational Improvements

- **Debugging**: Full trace visibility from schedule to alert
- **Monitoring**: Metrics on every pipeline stage
- **Reliability**: Redis persistence + self-healing
- **Scalability**: Horizontal worker scaling, reduced DB load
- **Maintainability**: 5 worker files → 1 unified analyzer

### Bug Fixes

1. **MFA Alert Bug**: Fixed via explicit findings emission
2. **Inconsistent Alerts**: All alerts go through AlertManager
3. **Orphaned Alerts**: Alert history enables detection
4. **Stale Data Analysis**: Coordinated syncs ensure fresh data

### Foundation for Features

Once refactor complete, enables:

- **Tenant alert preferences**: Enable/disable alert types
- **Real-time analysis**: Webhook-triggered syncs
- **Advanced scheduling**: Dependency-aware, smart batching
- **Multi-tenant scaling**: Better isolation and resource management

---

## Is This The Right Approach?

### Alternatives Considered

**1. Keep Current Architecture, Fix Issues Piecemeal**

- Fix MFA bug by explicit findings
- Add caching layer for queries
- Optimize indexes
- Keep separate workers

**Pros**: Less change, lower risk
**Cons**: Doesn't address root cause (redundancy), will accumulate more technical debt

**2. Microservices Architecture**

- Separate service per analysis type
- Shared data cache service
- Message queue between services

**Pros**: Maximum isolation, independent scaling
**Cons**: Over-engineered for current scale, operational complexity

**3. This Refactor: Unified Analysis with Modern Queue**

- Single analyzer with shared context
- BullMQ for job scheduling
- Enhanced observability

**Pros**: Addresses root causes, right-sized for scale, enables future features
**Cons**: Significant refactor required, need Redis infrastructure

### Decision: Go with Option 3

**Rationale**:

- You have no users yet (perfect time for breaking changes)
- Current architecture prevents scaling
- Technical debt will compound if not addressed
- New architecture enables planned features (alert preferences)
- Performance gains are substantial (30-60x faster)

---

## Risk Assessment

### High Risk Areas

1. **Data Migration**: Alert history table, new indexes
   - **Mitigation**: Test migrations on copy of production DB first

2. **Job Loss During Migration**: Switching from polling to BullMQ
   - **Mitigation**: Dual-running, feature flags, gradual rollout

3. **Redis Dependency**: New infrastructure component
   - **Mitigation**: Redis persistence (AOF+RDB), fallback to polling

4. **Analysis Logic Changes**: Moving from 5 workers to 1
   - **Mitigation**: Comprehensive testing, compare outputs before/after

### Medium Risk Areas

5. **Performance Regression**: What if unified analyzer is slower?
   - **Mitigation**: Benchmark each phase, can rollback

6. **Missing Edge Cases**: Current workers handle subtle cases
   - **Mitigation**: Side-by-side comparison during migration

### Low Risk Areas

7. **Breaking External APIs**: Not changing external interfaces
8. **Data Loss**: All changes are additive (new tables/indexes)

### Rollback Strategy

Each phase designed to be reversible:

- Feature flags control old vs new code paths
- Old scheduler kept until BullMQ proven
- Database changes are additive (don't drop old tables)
- Can revert to previous phase at any checkpoint

---

## Success Criteria

### Must Achieve

1. ✅ MFA alert bug no longer reproduces (verified with test cases)
2. ✅ Analysis completes in <60s (vs 15+ min currently)
3. ✅ Database queries reduced by >90% (measured)
4. ✅ Full trace visibility (can trace any job through pipeline)
5. ✅ Zero job loss during Redis restarts (tested)
6. ✅ Successful rollback test performed

### Should Achieve

7. ✅ Alert history provides debugging value (used to debug real issue)
8. ✅ No performance regression in any stage
9. ✅ Code is more maintainable (subjective but clear)
10. ✅ Documentation enables future developers to understand

### Nice to Have

11. ✅ Metrics dashboard showing pipeline health
12. ✅ Automated alerts for pipeline issues
13. ✅ Load testing validates 10x current scale

---

## Next Steps

Read the implementation phases in order:

1. **[Phase 1: Infrastructure Setup](./01_INFRASTRUCTURE_SETUP.md)**
   - Set up Redis and BullMQ
   - Implement QueueManager
   - Add health checks
   - Test job scheduling

2. **[Phase 2: Logging & Observability](./02_LOGGING_OBSERVABILITY.md)**
   - Implement trace IDs
   - Add structured logging
   - Create alert history table
   - Validate logging

3. **[Phase 3: Data Context Loader](./03_DATA_CONTEXT_LOADER.md)**
   - Build shared data loading
   - Create relationship graphs
   - Test performance

4. **Continue through remaining phases...**

Each phase is self-contained with:

- Prerequisites
- Step-by-step implementation
- Testing procedures
- Rollback instructions
- Success criteria

---

[→ Next: Phase 1 - Infrastructure Setup](./01_INFRASTRUCTURE_SETUP.md)
