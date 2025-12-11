# Phase 5: Alert System Improvements

[← Back to Index](./REFACTOR_INDEX.md) | [← Previous: Unified Analyzer](./04_UNIFIED_ANALYZER.md) | [Next: Database Optimizations →](./06_DATABASE_OPTIMIZATIONS.md)

---

## Overview

**Goal**: Fix MFA alert bug and consolidate all alert creation through AlertManager

**Key Issues to Resolve**:

1. MFA alerts persisting when tags are cleared (explicit findings)
2. LicenseAnalyzer creating alerts directly (inconsistent architecture)
3. Alert history integration
4. Tenant alert preferences foundation

---

## Issue 1: MFA Alert Bug Fix

### Root Cause

```typescript
// Current MFA Analyzer behavior:
if (hasNoMFAIssues) {
  // Doesn't emit anything - IMPLICIT "no findings"
  return;
}

await emitAnalysis(event, "mfa", findings); // Only emits when problems found
```

**Problem**: AlertManager can't distinguish between:

- "MFA analysis ran and found no issues" (should resolve alerts)
- "MFA analysis didn't run" (should NOT touch alerts)

### Solution: Explicit Findings Emission

```typescript
// New behavior in UnifiedAnalyzer:
const findings = await this.analyzeMFA(context);

// ALWAYS emit, even if empty
await this.emitFindings(context, {
  mfa: findings, // Empty array = "no issues found"
  // ...
});

// AlertManager receives explicit "0 findings" signal
// Can safely resolve alerts knowing analysis actually ran
```

### AlertManager Update

**File**: `src/analyzers/AlertManager.ts`

```typescript
private async processUnifiedAnalysis(event: UnifiedAnalysisEvent): Promise<void> {
  const { tenantId, dataSourceId, findings, analysisTypes } = event;

  // analysisTypes explicitly lists what was analyzed
  // e.g., ["mfa", "policy", "license", "stale"]

  // For each analysis type that ran:
  for (const analysisType of analysisTypes) {
    const typeFindings = findings[analysisType] || [];

    // Create/update alerts for findings
    for (const finding of typeFindings) {
      await this.createOrUpdateAlert(finding);
    }

    // Resolve alerts that no longer have findings
    // SAFE because we know this analysis type DID run
    await this.resolveAlertsForType(tenantId, dataSourceId, analysisType, typeFindings);
  }
}

private async resolveAlertsForType(
  tenantId: Id<'tenants'>,
  dataSourceId: Id<'data_sources'>,
  analysisType: string,
  currentFindings: Finding[]
): Promise<void> {
  // Get all active alerts for this analysis type
  const existingAlerts = await this.client.query(api.helpers.orm.list_s, {
    tableName: 'entity_alerts',
    filters: {
      tenantId,
      dataSourceId,
      status: 'active',
      alertType: this.getAlertTypesForAnalysis(analysisType),
    },
  });

  // Build set of entity IDs that currently have issues
  const entitiesWithIssues = new Set(currentFindings.map(f => f.entityId));

  // Resolve alerts for entities that no longer have issues
  const alertHistory = new AlertHistoryManager(this.client);

  for (const alert of existingAlerts) {
    if (!entitiesWithIssues.has(alert.entityId)) {
      // Issue resolved!
      await this.client.mutation(api.helpers.orm.update_s, {
        tableName: 'entity_alerts',
        id: alert._id,
        updates: {
          status: 'resolved',
          resolvedAt: Date.now(),
        },
      });

      // Record in history
      await alertHistory.recordChange({
        alertId: alert._id,
        alert: alert,
        previousStatus: 'active',
        newStatus: 'resolved',
        changedBy: `analysis_${TracingManager.getContext()?.traceId}`,
        metadata: {
          reason: 'no_findings',
          analysisType,
          findingsCount: 0,
        },
      });

      Logger.log({
        module: 'AlertManager',
        context: 'resolveAlert',
        message: `Resolved alert ${alert.alertType} for entity ${alert.entityId}`,
        metadata: {
          alertId: alert._id,
          analysisType,
        },
      });
    }
  }
}

private getAlertTypesForAnalysis(analysisType: string): string[] {
  const mapping: Record<string, string[]> = {
    mfa: ['mfa_not_enforced', 'mfa_partial_enforced'],
    policy: ['policy_gap'],
    license: ['license_waste', 'license_overuse'],
    stale: ['stale_user'],
  };

  return mapping[analysisType] || [];
}
```

---

## Issue 2: Consolidate License Alert Creation

### Current Problem

```typescript
// LicenseAnalyzer currently creates license_overuse alerts directly
await client.mutation(api.helpers.orm.insert_s, {
  tableName: "entity_alerts",
  record: {
    alertType: "license_overuse",
    // ... bypasses AlertManager
  },
});
```

### Solution: Emit Findings Like Other Analyzers

This is already fixed in UnifiedAnalyzer (Phase 4):

```typescript
// In UnifiedAnalyzer.analyzeLicenses():
if (consumed > total) {
  findings.push({
    entityId: license._id,
    alertType: "license_overuse",
    severity: "high",
    message: "License consumption exceeds available units",
    metadata: { consumed, total, overage: consumed - total },
  });
}

// Emitted to AlertManager like all other findings
await this.emitFindings(context, { license: findings });
```

---

## Issue 3: Alert History Integration

Already implemented in Phase 2, but ensure it's used everywhere:

### Create Alert with History

```typescript
private async createAlert(finding: Finding): Promise<void> {
  const alert = await this.client.mutation(api.helpers.orm.insert_s, {
    tableName: 'entity_alerts',
    record: {
      entityId: finding.entityId,
      tenantId: context.tenantId,
      dataSourceId: context.dataSourceId,
      alertType: finding.alertType,
      severity: finding.severity,
      message: finding.message,
      status: 'active',
      createdAt: Date.now(),
      metadata: finding.metadata,
    },
  });

  // Record creation in history
  const historyManager = new AlertHistoryManager(this.client);
  await historyManager.recordChange({
    alertId: alert._id,
    alert: alert,
    previousStatus: 'none', // Special value for new alerts
    newStatus: 'active',
    newSeverity: finding.severity,
    changedBy: `analysis_${TracingManager.getContext()?.traceId}`,
    metadata: {
      analysisType: this.getAnalysisTypeForAlert(finding.alertType),
      findingsCount: 1,
    },
  });

  Logger.log({
    module: 'AlertManager',
    context: 'createAlert',
    message: `Created alert: ${finding.alertType}`,
    metadata: {
      alertId: alert._id,
      entityId: finding.entityId,
      severity: finding.severity,
    },
  });
}
```

### Update Alert with History

```typescript
private async updateAlert(
  existingAlert: Doc<'entity_alerts'>,
  finding: Finding
): Promise<void> {
  const severityChanged = existingAlert.severity !== finding.severity;
  const messageChanged = existingAlert.message !== finding.message;

  if (!severityChanged && !messageChanged) {
    return; // No changes needed
  }

  await this.client.mutation(api.helpers.orm.update_s, {
    tableName: 'entity_alerts',
    id: existingAlert._id,
    updates: {
      severity: finding.severity,
      message: finding.message,
      metadata: finding.metadata,
      updatedAt: Date.now(),
    },
  });

  // Record update in history
  const historyManager = new AlertHistoryManager(this.client);
  if (severityChanged) {
    await historyManager.recordChange({
      alertId: existingAlert._id,
      alert: existingAlert,
      previousStatus: existingAlert.status,
      newStatus: existingAlert.status, // Status unchanged
      previousSeverity: existingAlert.severity,
      newSeverity: finding.severity,
      changedBy: `analysis_${TracingManager.getContext()?.traceId}`,
      metadata: {
        reason: 'severity_escalation',
        oldSeverity: existingAlert.severity,
        newSeverity: finding.severity,
      },
    });
  }
}
```

---

## Issue 4: Foundation for Tenant Alert Preferences

### Schema Addition (For Future)

```typescript
// Don't implement full feature yet, just add schema
defineTable("tenant_alert_preferences", {
  tenantId: v.id("tenants"),
  alertType: v.string(),
  enabled: v.boolean(),
  severity: v.optional(v.string()), // Optional override
  metadata: v.optional(v.any()),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_tenant", ["tenantId"])
  .index("by_tenant_type", ["tenantId", "alertType"]);
```

### Preference Check (Placeholder)

```typescript
private async shouldCreateAlert(
  tenantId: Id<'tenants'>,
  alertType: string
): Promise<boolean> {
  // TODO: Implement in future phase
  // For now, always create alerts
  return true;

  /* Future implementation:
  const pref = await this.client.query(api.helpers.orm.list_s, {
    tableName: 'tenant_alert_preferences',
    index: {
      name: 'by_tenant_type',
      params: { tenantId, alertType }
    }
  });

  return pref.length === 0 || pref[0].enabled;
  */
}
```

---

## Testing MFA Bug Fix

### Test Case 1: Alert Resolves When Issue Fixed

```typescript
it("should resolve MFA alert when MFA is enabled", async () => {
  // Setup: Identity with no MFA
  const identity = await createIdentity({ email: "test@example.com" });

  // First analysis: No MFA policy
  await unifiedAnalyzer.execute({ tenantId, dataSourceId, syncId: "sync1" });

  // Verify alert created
  let alerts = await getActiveAlerts(identity._id);
  expect(alerts.some((a) => a.alertType === "mfa_not_enforced")).toBe(true);

  // Enable MFA policy
  await createMFAPolicy({ includeGroups: ["All Users"] });

  // Second analysis: With MFA policy
  await unifiedAnalyzer.execute({ tenantId, dataSourceId, syncId: "sync2" });

  // Verify alert resolved
  alerts = await getActiveAlerts(identity._id);
  expect(alerts.some((a) => a.alertType === "mfa_not_enforced")).toBe(false);

  // Verify history shows resolution
  const history = await getAlertHistory(identity._id);
  const resolved = history.find(
    (h) => h.alertType === "mfa_not_enforced" && h.newStatus === "resolved",
  );
  expect(resolved).toBeDefined();
  expect(resolved.metadata.reason).toBe("no_findings");
});
```

### Test Case 2: Alert NOT Resolved When Analysis Doesn't Run

```typescript
it("should not touch MFA alerts when only license sync runs", async () => {
  // Setup: Identity with MFA alert
  const identity = await createIdentity({ email: "test@example.com" });
  await unifiedAnalyzer.execute({ tenantId, dataSourceId, syncId: "sync1" });

  const alertsBefore = await getActiveAlerts(identity._id);
  const mfaAlert = alertsBefore.find((a) => a.alertType === "mfa_not_enforced");
  expect(mfaAlert).toBeDefined();

  // Only license sync (shouldn't trigger MFA analysis)
  await triggerLicenseSync({ tenantId, dataSourceId });

  // Verify MFA alert still active (analysis didn't run)
  const alertsAfter = await getActiveAlerts(identity._id);
  const mfaAlertAfter = alertsAfter.find(
    (a) => a.alertType === "mfa_not_enforced",
  );
  expect(mfaAlertAfter).toBeDefined();
  expect(mfaAlertAfter._id).toBe(mfaAlert._id); // Same alert, not touched
});
```

### Test Case 3: Tag and Alert Stay in Sync

```typescript
it("should keep tags and alerts in sync", async () => {
  // Setup: Identity with no MFA
  const identity = await createIdentity({ email: "test@example.com" });

  // First analysis
  await unifiedAnalyzer.execute({ tenantId, dataSourceId, syncId: "sync1" });

  // Verify both tag and alert
  const entity1 = await getEntity(identity._id);
  expect(entity1.tags).toContain("No MFA");

  const alerts1 = await getActiveAlerts(identity._id);
  expect(alerts1.some((a) => a.alertType === "mfa_not_enforced")).toBe(true);

  // Enable MFA
  await createMFAPolicy({ includeGroups: ["All Users"] });

  // Second analysis
  await unifiedAnalyzer.execute({ tenantId, dataSourceId, syncId: "sync2" });

  // Verify both tag AND alert removed
  const entity2 = await getEntity(identity._id);
  expect(entity2.tags).not.toContain("No MFA");

  const alerts2 = await getActiveAlerts(identity._id);
  expect(alerts2.some((a) => a.alertType === "mfa_not_enforced")).toBe(false);
});
```

---

## Alert Flapping Detection (Bonus)

Add detection for alerts that flip on/off repeatedly:

```typescript
async function detectFlapping(alertId: Id<"entity_alerts">): Promise<boolean> {
  const history = await alertHistoryManager.getHistory(alertId);

  // Check last 24 hours
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const recentHistory = history.filter((h) => h.changedAt > oneDayAgo);

  // Count status changes
  const statusChanges = recentHistory.filter(
    (h) => h.previousStatus !== h.newStatus,
  ).length;

  // Flapping if >5 status changes in 24 hours
  return statusChanges > 5;
}

// If flapping detected, maybe suppress notifications or flag for review
```

---

## Success Criteria

- [ ] MFA alert bug no longer reproduces
- [ ] All alert types created through AlertManager (no direct creation)
- [ ] Alert history records all state transitions
- [ ] Tags and alerts stay synchronized
- [ ] Test cases pass for alert resolution
- [ ] Tenant alert preferences schema added (not implemented yet)

---

[→ Next: Phase 6 - Database Optimizations](./06_DATABASE_OPTIMIZATIONS.md)
