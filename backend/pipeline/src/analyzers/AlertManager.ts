/**
 * AlertManager - Creates and manages alerts from UnifiedAnalyzer findings
 *
 * Phase 5 Implementation:
 * - Subscribes to analysis.unified events
 * - Creates/updates/resolves alerts based on findings
 * - Fixes MFA alert bug via explicit analysisTypes
 * - Updates entity states
 * - Records alert history
 *
 * Architecture:
 * UnifiedAnalyzer → analysis.unified event → AlertManager → entity_alerts table
 */

import { natsClient } from '../lib/nats.js';
import { client } from '@workspace/shared/lib/convex.js';
import { api } from '@workspace/database/convex/_generated/api.js';
import type { Doc, Id } from '@workspace/database/convex/_generated/dataModel.js';
import Logger from '../lib/logger.js';
import type {
  UnifiedAnalysisEvent,
  Finding,
  MFAFinding,
  LicenseWasteFinding,
  LicenseOveruseFinding,
  AnalysisType,
} from './types.js';

type CreateType = Partial<Doc<'entity_alerts'>>;
type UpdateType = { id: Id<'entity_alerts'>; updates: Partial<Doc<'entity_alerts'>> };

export class AlertManager {
  async start(): Promise<void> {
    Logger.log({
      module: 'AlertManager',
      context: 'start',
      message: 'Starting AlertManager (Phase 5)',
    });

    // Subscribe to unified analysis events
    await natsClient.subscribe('analysis.unified', this.handleUnifiedAnalysis.bind(this));

    Logger.log({
      module: 'AlertManager',
      context: 'start',
      message: 'AlertManager started, subscribed to analysis.unified events',
    });
  }

  /**
   * Handle unified analysis event from UnifiedAnalyzer
   *
   * Key improvement: No aggregation needed! UnifiedAnalyzer already ran all analyses
   * and provides explicit analysisTypes array to fix MFA bug.
   */
  private async handleUnifiedAnalysis(event: UnifiedAnalysisEvent): Promise<void> {
    Logger.log({
      module: 'AlertManager',
      context: 'handleUnifiedAnalysis',
      message: `Processing unified analysis for tenant ${event.tenantId}`,
      metadata: {
        analysisTypes: event.analysisTypes,
        totalFindings: event.stats.totalFindings,
        critical: event.stats.critical,
        high: event.stats.high,
      },
    });

    try {
      // Collect all findings from all analysis types
      const allFindings: Finding[] = [
        ...event.findings.mfa,
        ...event.findings.policy,
        ...event.findings.license,
        ...event.findings.stale,
      ];

      // Group findings by entity
      const findingsByEntity = new Map<Id<'entities'>, Finding[]>();
      for (const finding of allFindings) {
        if (!findingsByEntity.has(finding.entityId)) {
          findingsByEntity.set(finding.entityId, []);
        }
        findingsByEntity.get(finding.entityId)!.push(finding);
      }

      Logger.log({
        module: 'AlertManager',
        context: 'handleUnifiedAnalysis',
        message: `Grouped ${allFindings.length} findings for ${findingsByEntity.size} entities`,
      });

      // Process each entity's findings
      const createAlerts: CreateType[] = [];
      const updateAlerts: UpdateType[] = [];
      const resolveAlerts: UpdateType[] = [];

      for (const [entityId, findings] of findingsByEntity) {
        const result = await this.processEntityFindings(
          entityId,
          findings,
          event,
          new Set(event.analysisTypes)
        );
        createAlerts.push(...result.created);
        updateAlerts.push(...result.updated);
        resolveAlerts.push(...result.resolved);
      }

      // CRITICAL FIX: Also resolve alerts for entities with NO findings
      // This fixes the MFA alert bug - if MFA analysis ran but found no issues,
      // we need to resolve old MFA alerts
      const resolvedFromMissingEntities = await this.resolveAlertsForMissingEntities(
        event,
        findingsByEntity
      );
      resolveAlerts.push(...resolvedFromMissingEntities);

      // Batch database operations
      if (createAlerts.length > 0) {
        await client.mutation(api.helpers.orm.insert_s, {
          tableName: 'entity_alerts',
          secret: process.env.CONVEX_API_KEY!,
          tenantId: event.tenantId,
          data: createAlerts,
        });
      }

      if (updateAlerts.length > 0) {
        await client.mutation(api.helpers.orm.update_s, {
          tableName: 'entity_alerts',
          secret: process.env.CONVEX_API_KEY!,
          data: updateAlerts,
        });
      }

      if (resolveAlerts.length > 0) {
        await client.mutation(api.helpers.orm.update_s, {
          tableName: 'entity_alerts',
          secret: process.env.CONVEX_API_KEY!,
          data: resolveAlerts,
        });
      }

      Logger.log({
        module: 'AlertManager',
        context: 'handleUnifiedAnalysis',
        message: 'Alert operations complete',
        metadata: {
          created: createAlerts.length,
          updated: updateAlerts.length,
          resolved: resolveAlerts.length,
        },
      });

      // Update entity states for all affected entities
      const affectedEntityIds = new Set([
        ...findingsByEntity.keys(),
        ...resolveAlerts.map((r) => r.updates.entityId as Id<'entities'>).filter(Boolean),
      ]);

      if (affectedEntityIds.size > 0) {
        await this.updateEntityStates(Array.from(affectedEntityIds), event.tenantId);
      }
    } catch (error) {
      Logger.log({
        module: 'AlertManager',
        context: 'handleUnifiedAnalysis',
        message: 'Failed to process unified analysis',
        level: 'error',
        error: error as Error,
      });
    }
  }

  /**
   * Process findings for a single entity
   *
   * Creates/updates expected alerts, resolves alerts that should no longer exist
   */
  private async processEntityFindings(
    entityId: Id<'entities'>,
    findings: Finding[],
    event: UnifiedAnalysisEvent,
    includedAnalysisTypes: Set<AnalysisType>
  ): Promise<{ created: CreateType[]; updated: UpdateType[]; resolved: UpdateType[] }> {
    // Fetch entity data
    const entity = (await client.query(api.helpers.orm.get_s, {
      tableName: 'entities',
      id: entityId,
      secret: process.env.CONVEX_API_KEY!,
    })) as Doc<'entities'> | null;

    if (!entity) {
      Logger.log({
        module: 'AlertManager',
        context: 'processEntityFindings',
        message: `Entity ${entityId} not found, skipping`,
        level: 'warn',
      });
      return { created: [], updated: [], resolved: [] };
    }

    // Build expected alerts map (handles multiple license_waste alerts per entity)
    const expectedAlerts = new Map<string, Finding>();
    for (const finding of findings) {
      const alertKey = this.getAlertKey(finding);
      expectedAlerts.set(alertKey, finding);
    }

    // Get existing active alerts for this entity
    const existingAlerts = (await client.query(api.helpers.orm.list_s, {
      tableName: 'entity_alerts',
      secret: process.env.CONVEX_API_KEY!,
      index: {
        name: 'by_entity_status',
        params: {
          entityId,
          status: 'active',
        },
      },
      tenantId: event.tenantId,
    })) as Doc<'entity_alerts'>[];

    const creates: CreateType[] = [];
    const updates: UpdateType[] = [];
    const resolves: UpdateType[] = [];

    // Create or update expected alerts
    for (const [alertKey, finding] of expectedAlerts) {
      const existing = this.findExistingAlert(existingAlerts, finding);

      if (existing) {
        // Update existing alert
        updates.push({
          id: existing._id,
          updates: {
            severity: finding.severity,
            message: finding.message,
            metadata: { ...finding.metadata, ...this.getEntityMetadata(entity) },
            updatedAt: Date.now(),
          },
        });
      } else {
        // Create new alert
        creates.push({
          tenantId: event.tenantId,
          entityId,
          dataSourceId: event.dataSourceId,
          integrationSlug: event.integrationType,
          siteId: entity.siteId,
          alertType: finding.alertType,
          severity: finding.severity,
          message: finding.message,
          metadata: { ...finding.metadata, ...this.getEntityMetadata(entity) },
          status: 'active',
          updatedAt: Date.now(),
        });
      }
    }

    // Resolve alerts that should no longer exist
    for (const existing of existingAlerts) {
      const ownerAnalysisType = this.getAlertOwnerType(existing.alertType);

      // Only resolve if the owning analysis type ran in this batch
      if (!includedAnalysisTypes.has(ownerAnalysisType)) {
        continue; // Skip - no fresh data for this alert type
      }

      // Check if this alert should still exist
      const alertKey = this.getExistingAlertKey(existing);
      if (!expectedAlerts.has(alertKey)) {
        resolves.push({
          id: existing._id,
          updates: {
            status: 'resolved',
            resolvedAt: Date.now(),
            updatedAt: Date.now(),
          },
        });
      }
    }

    return { created: creates, updated: updates, resolved: resolves };
  }

  /**
   * CRITICAL FIX for MFA alert bug:
   * Resolve alerts for entities that had NO findings in this analysis batch
   *
   * Example: MFA analysis ran and found no issues for an entity.
   * Old alerts for that entity should be resolved.
   */
  private async resolveAlertsForMissingEntities(
    event: UnifiedAnalysisEvent,
    entitiesWithFindings: Map<Id<'entities'>, Finding[]>
  ): Promise<UpdateType[]> {
    const resolves: UpdateType[] = [];

    // For each analysis type that ran, find entities with active alerts but no findings
    for (const analysisType of event.analysisTypes) {
      const alertTypes = this.getAlertTypesForAnalysis(analysisType);

      // Query all active alerts for this data source
      // Note: Using by_data_source index, will add composite index in Phase 6.1
      const allAlerts = (await client.query(api.helpers.orm.list_s, {
        tableName: 'entity_alerts',
        secret: process.env.CONVEX_API_KEY!,
        index: {
          name: 'by_data_source',
          params: {
            dataSourceId: event.dataSourceId,
          },
        },
        tenantId: event.tenantId,
      })) as Doc<'entity_alerts'>[];

      // Filter for relevant alert types and active status
      const relevantAlerts = allAlerts.filter(
        (alert) => alertTypes.includes(alert.alertType) && alert.status === 'active'
      );

      // Resolve alerts for entities that had no findings
      for (const alert of relevantAlerts) {
        if (!entitiesWithFindings.has(alert.entityId)) {
          resolves.push({
            id: alert._id,
            updates: {
              status: 'resolved',
              resolvedAt: Date.now(),
              updatedAt: Date.now(),
            },
          });
        }
      }
    }

    return resolves;
  }

  /**
   * Get unique key for a finding (handles multiple license_waste per entity)
   */
  private getAlertKey(finding: Finding): string {
    if (finding.alertType === 'license_waste') {
      const wasteFinding = finding as LicenseWasteFinding;
      // Use first license SKU ID as key (findings should have one license per alert)
      const licenseSkuId = wasteFinding.metadata.wastedLicenses[0]?.licenseSkuId;
      return `${finding.alertType}:${licenseSkuId}`;
    }
    return finding.alertType;
  }

  /**
   * Get unique key for an existing alert
   */
  private getExistingAlertKey(alert: Doc<'entity_alerts'>): string {
    if (alert.alertType === 'license_waste' && alert.metadata?.licenseSkuId) {
      return `${alert.alertType}:${alert.metadata.licenseSkuId}`;
    }
    return alert.alertType;
  }

  /**
   * Find existing alert matching a finding
   */
  private findExistingAlert(
    existingAlerts: Doc<'entity_alerts'>[],
    finding: Finding
  ): Doc<'entity_alerts'> | undefined {
    if (finding.alertType === 'license_waste') {
      const wasteFinding = finding as LicenseWasteFinding;
      const licenseSkuId = wasteFinding.metadata.wastedLicenses[0]?.licenseSkuId;
      return existingAlerts.find(
        (a) => a.alertType === 'license_waste' && a.metadata?.licenseSkuId === licenseSkuId
      );
    }
    return existingAlerts.find((a) => a.alertType === finding.alertType);
  }

  /**
   * Extract entity metadata for alert
   */
  private getEntityMetadata(entity: Doc<'entities'>): Record<string, any> {
    return {
      email: entity.normalizedData.email || entity.normalizedData.name,
      name: entity.normalizedData.name,
    };
  }

  /**
   * Determine which analysis type owns/manages this alert type
   */
  private getAlertOwnerType(alertType: string): AnalysisType {
    switch (alertType) {
      case 'mfa_not_enforced':
      case 'mfa_partial_enforced':
        return 'mfa';
      case 'stale_user':
        return 'stale';
      case 'license_waste':
      case 'license_overuse':
        return 'license';
      case 'policy_gap':
        return 'policy';
      default:
        return 'mfa'; // Default fallback
    }
  }

  /**
   * Get alert types produced by an analysis type
   */
  private getAlertTypesForAnalysis(analysisType: AnalysisType): string[] {
    switch (analysisType) {
      case 'mfa':
        return ['mfa_not_enforced', 'mfa_partial_enforced'];
      case 'stale':
        return ['stale_user'];
      case 'license':
        return ['license_waste', 'license_overuse'];
      case 'policy':
        return ['policy_gap'];
      default:
        return [];
    }
  }

  /**
   * Update entity states based on active alerts
   */
  private async updateEntityStates(
    entityIds: Id<'entities'>[],
    tenantId: Id<'tenants'>
  ): Promise<void> {
    Logger.log({
      module: 'AlertManager',
      context: 'updateEntityStates',
      message: `Updating states for ${entityIds.length} entities`,
    });

    const stateUpdates: { id: Id<'entities'>; updates: Partial<Doc<'entities'>> }[] = [];

    for (const entityId of entityIds) {
      const newState = await this.calculateEntityState(entityId, tenantId);
      stateUpdates.push({
        id: entityId,
        updates: {
          state: newState,
          updatedAt: Date.now(),
        },
      });
    }

    if (stateUpdates.length > 0) {
      await client.mutation(api.helpers.orm.update_s, {
        tableName: 'entities',
        secret: process.env.CONVEX_API_KEY!,
        data: stateUpdates,
      });
    }

    Logger.log({
      module: 'AlertManager',
      context: 'updateEntityStates',
      message: `Updated ${stateUpdates.length} entity states`,
    });
  }

  /**
   * Calculate entity state based on active alerts
   */
  private async calculateEntityState(
    entityId: Id<'entities'>,
    tenantId: Id<'tenants'>
  ): Promise<'normal' | 'low' | 'warn' | 'critical'> {
    try {
      const alerts = (await client.query(api.helpers.orm.list_s, {
        tableName: 'entity_alerts',
        secret: process.env.CONVEX_API_KEY!,
        index: {
          name: 'by_entity_status',
          params: {
            entityId,
            status: 'active',
          },
        },
        tenantId,
      })) as Doc<'entity_alerts'>[];

      // Determine state based on highest severity
      const hasCriticalOrHigh = alerts.some(
        (alert) => alert.severity === 'critical' || alert.severity === 'high'
      );
      if (hasCriticalOrHigh) {
        return 'critical';
      }

      const hasMedium = alerts.some((alert) => alert.severity === 'medium');
      if (hasMedium) {
        return 'warn';
      }

      const hasLow = alerts.some((alert) => alert.severity === 'low');
      if (hasLow) {
        return 'low';
      }

      return 'normal';
    } catch (error) {
      Logger.log({
        module: 'AlertManager',
        context: 'calculateEntityState',
        message: 'Failed to calculate state',
        level: 'error',
        error: error as Error,
      });
      return 'normal';
    }
  }
}
