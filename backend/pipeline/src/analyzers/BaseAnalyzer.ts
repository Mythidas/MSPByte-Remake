import { Id } from "@workspace/database/convex/_generated/dataModel.js";
import {
  AnalysisContext,
  AnalyzerResult,
  AlertType,
  AlertSeverity,
  Alert,
  EntityState,
} from "src/types.js";

/**
 * Base analyzer abstract class
 * All concrete analyzers extend this
 */
export abstract class BaseAnalyzer {
  /**
   * Analyze the context and return results
   * Must be implemented by concrete analyzers
   */
  abstract analyze(context: AnalysisContext): Promise<AnalyzerResult>;

  /**
   * Get analyzer name (for logging/debugging)
   */
  abstract getName(): string;

  /**
   * Create an empty analyzer result
   */
  protected createEmptyResult(): AnalyzerResult {
    return {
      alerts: [],
      entityTags: new Map(),
      entityStates: new Map(),
    };
  }

  /**
   * Helper to create an alert
   */
  protected createAlert(
    entityId: Id<"entities">,
    alertType: AlertType,
    severity: AlertSeverity,
    message: string,
    metadata?: Record<string, any>,
  ): Alert {
    // Fingerprint format: {alertType}:{entityId}
    const fingerprint = `${alertType}:${entityId}`;

    return {
      entityId,
      alertType,
      severity,
      message,
      fingerprint,
      metadata,
    };
  }

  /**
   * Helper to add tags to an entity
   */
  protected addTags(
    result: AnalyzerResult,
    entityId: Id<"entities">,
    tags: string[],
  ): void {
    const existing = result.entityTags.get(entityId) || [];
    result.entityTags.set(entityId, [...existing, ...tags]);
  }

  /**
   * Helper to set entity state
   */
  protected setState(
    result: AnalyzerResult,
    entityId: Id<"entities">,
    state: EntityState,
  ): void {
    const existing = result.entityStates.get(entityId);
    if (
      !existing ||
      this.getStatePriority(state) > this.getStatePriority(existing)
    ) {
      result.entityStates.set(entityId, state);
    }
  }

  /**
   * Get numeric priority for state (higher = more severe)
   */
  private getStatePriority(state: EntityState): number {
    const priorities: Record<EntityState, number> = {
      normal: 0,
      low: 1,
      warn: 2,
      high: 3,
      critical: 4,
    };
    return priorities[state];
  }
}
