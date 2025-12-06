# Phase 4: Unified Analyzer

[← Back to Index](./REFACTOR_INDEX.md) | [← Previous: Data Context](./03_DATA_CONTEXT_LOADER.md) | [Next: Alert System →](./05_ALERT_SYSTEM.md)

---

## Overview

**Goal**: Consolidate 5 separate workers into single UnifiedAnalyzer

**Files to Replace**:
- `Microsoft365IdentitySecurityAnalyzer.ts` (MFA analysis)
- `Microsoft365PolicyAnalyzer.ts` (Policy coverage)
- `Microsoft365LicenseAnalyzer.ts` (License waste)
- `Microsoft365StaleUserAnalyzer.ts` (Stale users)
- `BaseWorker.ts` (No longer needed)

**Files to Keep**:
- `CleanupWorker.ts` (Different concern)

---

## UnifiedAnalyzer Implementation

**File**: `src/analyzers/UnifiedAnalyzer.ts`

```typescript
import NatsClient from '../lib/nats';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import DataContextLoader from '../context/DataContextLoader';
import { AnalysisContext } from '../context/AnalysisContext';
import { AnalysisHelpers } from '../context/AnalysisHelpers';
import Logger from '../lib/logger';
import TracingManager from '../lib/tracing';

interface LinkedEvent {
  tenantId: Id<'tenants'>;
  dataSourceId: Id<'data_sources'>;
  syncId: string;
  entityType: string;
  isFinalBatch: boolean;
  changedEntityIds?: Id<'entities'>[];
}

interface Finding {
  entityId: Id<'entities'>;
  alertType: string;
  severity: string;
  message: string;
  metadata: Record<string, any>;
}

class UnifiedAnalyzer {
  private client: ConvexHttpClient;
  private loader: DataContextLoader;
  private pendingAnalysis = new Map<string, NodeJS.Timeout>();
  private debounceMs = 300000; // 5 minutes
  private requiresFullContext = true;

  constructor(client: ConvexHttpClient) {
    this.client = client;
    this.loader = new DataContextLoader(client);
  }

  async initialize(): Promise<void> {
    // Subscribe to all linked events
    await NatsClient.subscribe('linked.>', this.handleLinkedEvent.bind(this));

    Logger.log({
      module: 'UnifiedAnalyzer',
      context: 'initialize',
      message: 'UnifiedAnalyzer initialized',
    });
  }

  private async handleLinkedEvent(event: LinkedEvent): Promise<void> {
    const { tenantId, dataSourceId, syncId, entityType, isFinalBatch } = event;

    const key = `${tenantId}:${dataSourceId}:${syncId}`;

    // Clear existing debounce timer
    if (this.pendingAnalysis.has(key)) {
      clearTimeout(this.pendingAnalysis.get(key)!);
    }

    // If requires full context and not final batch, wait
    if (this.requiresFullContext && !isFinalBatch) {
      Logger.log({
        module: 'UnifiedAnalyzer',
        context: 'handleLinkedEvent',
        message: 'Waiting for final batch',
        metadata: { syncId, entityType },
      });
      return;
    }

    // Debounce to collect multiple linked events
    this.pendingAnalysis.set(
      key,
      setTimeout(async () => {
        await this.execute({
          tenantId,
          dataSourceId,
          syncId,
          changedEntityIds: event.changedEntityIds,
        });
        this.pendingAnalysis.delete(key);
      }, this.debounceMs)
    );
  }

  private async execute(params: {
    tenantId: Id<'tenants'>;
    dataSourceId: Id<'data_sources'>;
    syncId: string;
    changedEntityIds?: Id<'entities'>[];
  }): Promise<void> {
    TracingManager.startTrace({
      syncId: params.syncId,
      tenantId: params.tenantId,
      dataSourceId: params.dataSourceId,
      stage: 'analyze',
    });

    Logger.startStage('unified_analysis', {
      tenantId: params.tenantId,
      syncId: params.syncId,
    });

    try {
      // Load all data once
      const context = await this.loader.load(params);

      // Run all analysis types
      const [mfaFindings, policyFindings, licenseFindings, staleFindings] =
        await Promise.all([
          this.analyzeMFA(context),
          this.analyzePolicyGaps(context),
          this.analyzeLicenses(context),
          this.analyzeStaleUsers(context),
        ]);

      // Emit all findings
      await this.emitFindings(context, {
        mfa: mfaFindings,
        policy: policyFindings,
        license: licenseFindings,
        stale: staleFindings,
      });

      Logger.endStage('unified_analysis', {
        totalFindings:
          mfaFindings.length +
          policyFindings.length +
          licenseFindings.length +
          staleFindings.length,
      });
    } catch (error) {
      Logger.log({
        module: 'UnifiedAnalyzer',
        context: 'execute',
        message: 'Analysis failed',
        level: 'error',
        error: error as Error,
      });
      throw error;
    }
  }

  // ==================== MFA ANALYSIS ====================

  private async analyzeMFA(context: AnalysisContext): Promise<Finding[]> {
    Logger.startStage('analyze_mfa');

    const findings: Finding[] = [];
    const identitiesToAnalyze = AnalysisHelpers.getIdentitiesToAnalyze(
      context,
      Array.from(context.changedIdentityIds || [])
    );

    for (const identity of identitiesToAnalyze) {
      const mfaCoverage = this.evaluateMFACoverage(context, identity);

      if (mfaCoverage === 'none') {
        findings.push({
          entityId: identity._id,
          alertType: 'mfa_not_enforced',
          severity: 'high',
          message: 'MFA is not enforced for this user',
          metadata: {
            identityId: identity._id,
            email: identity.normalizedData?.email,
          },
        });
      } else if (mfaCoverage === 'partial') {
        findings.push({
          entityId: identity._id,
          alertType: 'mfa_partial_enforced',
          severity: 'medium',
          message: 'MFA is partially enforced for this user',
          metadata: {
            identityId: identity._id,
            email: identity.normalizedData?.email,
          },
        });
      }
    }

    Logger.endStage('analyze_mfa', {
      identitiesAnalyzed: identitiesToAnalyze.length,
      findingsCount: findings.length,
    });

    return findings;
  }

  private evaluateMFACoverage(
    context: AnalysisContext,
    identity: Doc<'entities'>
  ): 'full' | 'partial' | 'none' {
    const userGroups = AnalysisHelpers.getGroupsForIdentity(
      context,
      identity._id
    );

    let hasFullMFA = false;
    let hasPartialMFA = false;

    for (const policy of context.policies) {
      if (!AnalysisHelpers.doesPolicyApply(context, policy._id, identity._id)) {
        continue;
      }

      const mfaState = policy.normalizedData?.mfaState;
      if (mfaState === 'enabled') {
        hasFullMFA = true;
      } else if (mfaState === 'enabledForReportingButNotEnforced') {
        hasPartialMFA = true;
      }
    }

    if (hasFullMFA) return 'full';
    if (hasPartialMFA) return 'partial';
    return 'none';
  }

  // ==================== POLICY ANALYSIS ====================

  private async analyzePolicyGaps(context: AnalysisContext): Promise<Finding[]> {
    Logger.startStage('analyze_policy');

    const findings: Finding[] = [];
    const identitiesToAnalyze = AnalysisHelpers.getIdentitiesToAnalyze(
      context,
      Array.from(context.changedIdentityIds || [])
    );

    for (const identity of identitiesToAnalyze) {
      const hasAnyPolicy = context.policies.some(policy =>
        AnalysisHelpers.doesPolicyApply(context, policy._id, identity._id)
      );

      if (!hasAnyPolicy) {
        findings.push({
          entityId: identity._id,
          alertType: 'policy_gap',
          severity: 'medium',
          message: 'User has no conditional access policies applied',
          metadata: {
            identityId: identity._id,
            email: identity.normalizedData?.email,
          },
        });
      }
    }

    Logger.endStage('analyze_policy', {
      identitiesAnalyzed: identitiesToAnalyze.length,
      findingsCount: findings.length,
    });

    return findings;
  }

  // ==================== LICENSE ANALYSIS ====================

  private async analyzeLicenses(context: AnalysisContext): Promise<Finding[]> {
    Logger.startStage('analyze_license');

    const findings: Finding[] = [];

    // License waste: Licenses assigned to disabled/stale users
    for (const identity of context.identities) {
      const isDisabled = identity.normalizedData?.enabled === false;
      const isStale = this.isStaleUser(identity);
      const hasLicense = identity.normalizedData?.assignedLicenses?.length > 0;

      if (hasLicense && (isDisabled || isStale)) {
        findings.push({
          entityId: identity._id,
          alertType: 'license_waste',
          severity: 'low',
          message: 'License assigned to inactive user',
          metadata: {
            identityId: identity._id,
            email: identity.normalizedData?.email,
            reason: isDisabled ? 'disabled' : 'stale',
          },
        });
      }
    }

    // License overuse: consumed > total
    for (const license of context.licenses) {
      const consumed = license.normalizedData?.consumedUnits || 0;
      const total = license.normalizedData?.prepaidUnits?.enabled || 0;

      if (consumed > total) {
        findings.push({
          entityId: license._id,
          alertType: 'license_overuse',
          severity: 'high',
          message: 'License consumption exceeds available units',
          metadata: {
            skuPartNumber: license.normalizedData?.skuPartNumber,
            consumed,
            total,
            overage: consumed - total,
          },
        });
      }
    }

    Logger.endStage('analyze_license', {
      findingsCount: findings.length,
    });

    return findings;
  }

  // ==================== STALE USER ANALYSIS ====================

  private async analyzeStaleUsers(context: AnalysisContext): Promise<Finding[]> {
    Logger.startStage('analyze_stale');

    const findings: Finding[] = [];
    const staleThresholdDays = 90;
    const staleThresholdDate = Date.now() - staleThresholdDays * 24 * 60 * 60 * 1000;

    const identitiesToAnalyze = AnalysisHelpers.getIdentitiesToAnalyze(
      context,
      Array.from(context.changedIdentityIds || [])
    );

    for (const identity of identitiesToAnalyze) {
      if (this.isStaleUser(identity, staleThresholdDate)) {
        const daysSinceLogin = identity.normalizedData?.last_login_at
          ? Math.floor(
              (Date.now() - identity.normalizedData.last_login_at) /
                (24 * 60 * 60 * 1000)
            )
          : null;

        findings.push({
          entityId: identity._id,
          alertType: 'stale_user',
          severity: 'medium',
          message: `User has not logged in for ${daysSinceLogin || '90+'} days`,
          metadata: {
            identityId: identity._id,
            email: identity.normalizedData?.email,
            daysSinceLogin,
          },
        });
      }
    }

    Logger.endStage('analyze_stale', {
      identitiesAnalyzed: identitiesToAnalyze.length,
      findingsCount: findings.length,
    });

    return findings;
  }

  private isStaleUser(identity: Doc<'entities'>, threshold?: number): boolean {
    const staleThreshold = threshold || Date.now() - 90 * 24 * 60 * 60 * 1000;

    if (!identity.normalizedData?.enabled) {
      return false; // Disabled users handled separately
    }

    const lastLogin = identity.normalizedData?.last_login_at;
    return lastLogin ? lastLogin < staleThreshold : true;
  }

  // ==================== EMIT FINDINGS ====================

  private async emitFindings(
    context: AnalysisContext,
    findings: {
      mfa: Finding[];
      policy: Finding[];
      license: Finding[];
      stale: Finding[];
    }
  ): Promise<void> {
    Logger.startStage('emit_findings');

    // Emit to AlertManager
    await NatsClient.publish('analysis.unified', {
      tenantId: context.tenantId,
      dataSourceId: context.dataSourceId,
      syncId: context.syncId,
      traceId: TracingManager.getContext()?.traceId,
      analysisTypes: ['mfa', 'policy', 'license', 'stale'],
      findings: {
        mfa: findings.mfa,
        policy: findings.policy,
        license: findings.license,
        stale: findings.stale,
      },
      entityCounts: {
        identities: context.identities.length,
        groups: context.groups.length,
        policies: context.policies.length,
        licenses: context.licenses.length,
      },
    });

    Logger.endStage('emit_findings', {
      mfaFindings: findings.mfa.length,
      policyFindings: findings.policy.length,
      licenseFindings: findings.license.length,
      staleFindings: findings.stale.length,
    });
  }
}

export default UnifiedAnalyzer;
```

---

## Update AlertManager to Handle Unified Findings

**File**: `src/analyzers/AlertManager.ts` (modify)

```typescript
// Add new subscription for unified analysis
async initialize(): Promise<void> {
  // Keep existing subscriptions
  await NatsClient.subscribe('analysis.>', this.handleAnalysis.bind(this));

  // Add unified analyzer subscription
  await NatsClient.subscribe('analysis.unified', this.handleUnifiedAnalysis.bind(this));
}

private async handleUnifiedAnalysis(event: any): Promise<void> {
  const { tenantId, dataSourceId, syncId, findings, analysisTypes } = event;

  // Flatten all findings into single array
  const allFindings: Finding[] = [
    ...findings.mfa,
    ...findings.policy,
    ...findings.license,
    ...findings.stale,
  ];

  // Process through existing aggregation logic
  // (AlertManager already has processAnalysisBatch method)
  await this.processFindings(tenantId, dataSourceId, syncId, allFindings, analysisTypes);
}
```

---

## Migration Strategy

### Step 1: Deploy UnifiedAnalyzer Alongside Old Workers

```typescript
// Feature flag
const USE_UNIFIED_ANALYZER = process.env.USE_UNIFIED_ANALYZER === 'true';

if (USE_UNIFIED_ANALYZER) {
  const unifiedAnalyzer = new UnifiedAnalyzer(client);
  await unifiedAnalyzer.initialize();
} else {
  // Old workers
  const mfaAnalyzer = new Microsoft365IdentitySecurityAnalyzer(client);
  const policyAnalyzer = new Microsoft365PolicyAnalyzer(client);
  // ... etc
}
```

### Step 2: Compare Outputs

```typescript
// Run both in parallel, compare findings
if (process.env.COMPARE_ANALYZERS === 'true') {
  const [oldFindings, newFindings] = await Promise.all([
    runOldAnalyzers(),
    runUnifiedAnalyzer(),
  ]);

  compareFindings(oldFindings, newFindings);
}
```

### Step 3: Gradual Rollout

```bash
# Week 1: Test tenant only
export USE_UNIFIED_ANALYZER=true
export UNIFIED_ANALYZER_TENANTS=test_tenant_id

# Week 2: 10% of tenants
export UNIFIED_ANALYZER_TENANTS=tenant1,tenant2,tenant3

# Week 3: 50% of tenants
# Week 4: All tenants

# Week 5: Remove old workers
```

---

## Testing

```typescript
describe('UnifiedAnalyzer', () => {
  it('should produce same findings as old MFA analyzer', async () => {
    const oldFindings = await oldMFAAnalyzer.execute(event);
    const newFindings = await unifiedAnalyzer.analyzeMFA(context);

    expect(newFindings.length).toBe(oldFindings.length);
    expect(newFindings.map(f => f.entityId).sort()).toEqual(
      oldFindings.map(f => f.entityId).sort()
    );
  });

  it('should complete analysis in <60s', async () => {
    const start = Date.now();
    await unifiedAnalyzer.execute({ /* ... */ });
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(60000);
  });

  it('should emit all analysis types', async () => {
    const emittedEvents: any[] = [];
    NatsClient.on('publish', (event) => {
      if (event.subject === 'analysis.unified') {
        emittedEvents.push(event.data);
      }
    });

    await unifiedAnalyzer.execute({ /* ... */ });

    expect(emittedEvents.length).toBe(1);
    expect(emittedEvents[0].analysisTypes).toEqual([
      'mfa',
      'policy',
      'license',
      'stale',
    ]);
  });
});
```

---

## Rollback Plan

If issues discovered:

1. Set `USE_UNIFIED_ANALYZER=false`
2. Restart application
3. Old workers resume operation
4. No data loss (database unchanged)

---

## Success Criteria

- [ ] UnifiedAnalyzer produces identical findings to old workers
- [ ] Analysis completes in <60 seconds (vs 15+ min)
- [ ] All analysis types included
- [ ] Findings emitted to AlertManager correctly
- [ ] No regression in alert accuracy
- [ ] Can toggle between old/new via feature flag

---

[→ Next: Phase 5 - Alert System Improvements](./05_ALERT_SYSTEM.md)
