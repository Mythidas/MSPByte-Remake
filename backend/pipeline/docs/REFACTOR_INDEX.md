# Pipeline Refactor - Complete Migration Guide

**Status**: Planning Phase
**Created**: 2025-12-05
**Estimated Timeline**: 8-10 days full implementation

---

## Table of Contents

1. [Overview & Current State Analysis](./00_OVERVIEW.md)
2. [Phase 1: Infrastructure Setup (BullMQ + Redis)](./01_INFRASTRUCTURE_SETUP.md)
3. [Phase 2: Logging & Observability](./02_LOGGING_OBSERVABILITY.md)
4. [Phase 3: Data Context Loader](./03_DATA_CONTEXT_LOADER.md)
5. [Phase 4: Unified Analyzer](./04_UNIFIED_ANALYZER.md)
6. [Phase 5: Alert System Improvements](./05_ALERT_SYSTEM.md)
7. [Phase 6: Database Optimizations](./06_DATABASE_OPTIMIZATIONS.md)
8. [Phase 7: Migration & Deployment](./07_MIGRATION_DEPLOYMENT.md)
9. [Appendix: Code Examples & Utilities](./APPENDIX_CODE_EXAMPLES.md)

---

## Quick Start

### Read First

Start with [00_OVERVIEW.md](./00_OVERVIEW.md) to understand:

- Current architecture and identified problems
- Why this refactor is necessary
- High-level solution approach
- Expected benefits

### Implementation Order

Follow phases **sequentially** (1 → 7):

- Each phase builds on the previous
- Includes testing/validation before moving forward
- Can pause between phases safely

### Prerequisites

- Node.js 18+
- Access to Redis instance (local or cloud)
- Convex database access
- NATS server running

---

## Key Architectural Changes

### Before

```
Scheduler (DB polling every 60s)
  ↓
Jobs → NATS events
  ↓
5 Separate Workers (redundant data fetching)
  ↓
AlertManager / TagManager (dual system)
```

### After

```
BullMQ Queue (push-based, <1s latency)
  ↓
Jobs → NATS events
  ↓
DataContextLoader (fetch once)
  ↓
UnifiedAnalyzer (all analysis types)
  ↓
AlertManager (unified, with history)
```

---

## Critical Issues Being Resolved

1. **MFA Alert Bug**: Tags cleared but alerts persist
   - **Root Cause**: Implicit "no findings" state
   - **Solution**: Explicit empty findings emission

2. **Redundant Data Fetching**: Same data fetched 4+ times
   - **Root Cause**: Each worker fetches independently
   - **Solution**: Shared DataContextLoader

3. **Database Polling**: 60s latency on job execution
   - **Root Cause**: setInterval polling
   - **Solution**: BullMQ push-based queue

4. **Poor Observability**: Can't trace jobs through pipeline
   - **Root Cause**: No trace IDs or timing metrics
   - **Solution**: Structured logging with tracing

5. **N+1 Query Patterns**: Hundreds of redundant queries
   - **Root Cause**: Per-entity relationship queries
   - **Solution**: Batch fetching with indexes

---

## Performance Improvements Expected

| Metric                   | Current      | After Refactor | Improvement         |
| ------------------------ | ------------ | -------------- | ------------------- |
| Job latency              | 60s avg      | <1s            | 60x faster          |
| DB queries per analysis  | 800+         | 7-10           | 99% reduction       |
| Analysis runtime         | 15+ min      | 30s            | 30x faster          |
| Data fetching redundancy | 4x duplicate | 1x             | 75% reduction       |
| Debugging capability     | Poor         | Full tracing   | Complete visibility |

---

## Migration Strategy

### Safe Rollout

1. **Parallel Running**: Keep old system running during migration
2. **Feature Flags**: Toggle between old/new per tenant
3. **Gradual Migration**: Move tenants one at a time
4. **Rollback Plan**: Can revert at any point

### Testing Checkpoints

Each phase includes:

- Unit tests
- Integration tests
- Performance validation
- Rollback verification

---

## Future Enhancements (Post-Refactor)

Once core refactor is complete, the new architecture enables:

1. **Tenant Alert Preferences**
   - Enable/disable specific alert types per tenant
   - Custom severity thresholds
   - Alert frequency controls

2. **Advanced Scheduling**
   - Smart data source batching
   - Dependency-aware analysis
   - Off-peak optimization

3. **Real-time Analysis**
   - Webhook-triggered syncs
   - Incremental updates
   - Sub-minute alert latency

4. **Multi-Provider Support**
   - Easier to add new integrations
   - Shared analysis framework
   - Provider-specific optimizations

---

## Context for Future Claude Sessions

### Architecture Decisions Made

**Why BullMQ over alternatives?**

- Industry standard with excellent TypeScript support
- Rich feature set (priorities, retries, rate limiting, flows)
- Redis persistence handles crash recovery
- Horizontal scaling support
- Better than database polling or pure NATS

**Why UnifiedAnalyzer over separate workers?**

- Eliminates redundant data fetching (primary goal)
- Ensures consistent data snapshot across all analysis
- Simplifies debugging (single execution path)
- Easier to add new analysis types
- Coordinates dependent analysis types

**Why keep NATS for events?**

- NATS excellent for pub/sub event distribution
- BullMQ excellent for job queuing
- Use each for its strength (not replacing, complementing)
- Allows future real-time event streaming

**Why alert history table?**

- Critical for debugging alert lifecycle issues
- Enables audit trail for compliance
- Foundation for alert flapping detection
- User-facing feature potential

### Key Trade-offs

**Redis Infrastructure**

- Pro: Fast, reliable, feature-rich
- Con: Additional infrastructure to maintain
- Decision: Worth it for performance gains and reliability

**Single vs Multiple Workers**

- Pro (single): Eliminates redundancy, simpler debugging
- Con (single): Less modularity, larger file
- Decision: Performance and consistency trump modularity

**Database as Audit Trail**

- Pro: Complete history, queryable, permanent
- Con: Additional writes on every job
- Decision: Worth it for debugging and compliance

### Known Limitations

1. **BullMQ requires Redis**: If Redis unavailable, need fallback to polling
2. **Large tenant scaling**: May need queue-per-tenant for 1000+ tenants
3. **Analysis types must complete**: No partial success (all-or-nothing per sync)

### Extension Points

When implementing **tenant alert preferences** later:

```typescript
// Schema addition
defineTable("tenant_alert_preferences", {
  tenantId: v.id("tenants"),
  alertType: v.string(),
  enabled: v.boolean(),
  severity: v.optional(v.string()),
  metadata: v.any(),
});

// Check in AlertManager before creating alert
const prefs = await getAlertPreferences(tenantId);
if (!prefs[alertType]?.enabled) {
  return; // Skip alert creation
}
```

Location: `AlertManager.processAnalysisBatch()` after line 250 (filtering step)

---

## Getting Help

### Documentation Structure

- Each phase file is self-contained
- Code examples are complete and runnable
- Includes testing and validation steps
- Has rollback procedures

### Reading Order for Different Goals

**Just understanding the refactor?**
→ Read [00_OVERVIEW.md](./00_OVERVIEW.md) only

**Implementing specific phase?**
→ Read overview + that phase's file

**Full implementation?**
→ Read all files in sequence

**Debugging during migration?**
→ Check phase file + [APPENDIX_CODE_EXAMPLES.md](./APPENDIX_CODE_EXAMPLES.md)

---

## Progress Tracking

### Phase Completion Checklist

- [ ] Phase 1: Infrastructure Setup
  - [ ] Redis installed and configured
  - [ ] BullMQ integrated
  - [ ] Health checks implemented
  - [ ] Tested job scheduling

- [ ] Phase 2: Logging & Observability
  - [ ] Trace IDs implemented
  - [ ] Structured logging added
  - [ ] Alert history table created
  - [ ] Logs validated

- [ ] Phase 3: Data Context Loader
  - [ ] DataContextLoader implemented
  - [ ] Relationship graphs working
  - [ ] Performance tested
  - [ ] Integration tested

- [ ] Phase 4: Unified Analyzer
  - [ ] UnifiedAnalyzer created
  - [ ] All analysis types migrated
  - [ ] Event emission verified
  - [ ] Compared output with old workers

- [ ] Phase 5: Alert System
  - [ ] MFA bug fixed
  - [ ] License alerts consolidated
  - [ ] Alert history working
  - [ ] Alert lifecycle tested

- [ ] Phase 6: Database Optimizations
  - [ ] Indexes added
  - [ ] Linker optimized
  - [ ] Query performance measured
  - [ ] Validated improvements

- [ ] Phase 7: Migration & Deployment
  - [ ] Feature flags implemented
  - [ ] Parallel running tested
  - [ ] Tenant migration successful
  - [ ] Old system deprecated

### Success Criteria

**Must achieve before considering complete:**

1. MFA alert bug no longer reproduces
2. Analysis completes in <60s (vs 15min currently)
3. DB queries reduced by >90%
4. Full trace visibility for any job
5. Zero data loss during Redis restarts
6. Successful rollback test performed

---

## Notes

**Last Updated**: 2025-12-05
**Next Review**: After each phase completion
**Owner**: Backend team

This refactor addresses fundamental architectural issues that prevent the platform from scaling. The current system works but is inefficient and difficult to debug. The new architecture provides a solid foundation for growth while fixing critical bugs and performance issues.
