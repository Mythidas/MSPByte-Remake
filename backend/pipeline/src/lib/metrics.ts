/**
 * Metrics collector for tracking pipeline performance
 * Tracks:
 * - Stage durations (adapter, processor, linker, analyzer)
 * - Convex function call counts (queries, mutations, actions)
 * - API call counts
 * - Entity change counts (created, updated, deleted, unchanged)
 */

export interface StageMetrics {
  adapter_ms?: number;
  processor_ms?: number;
  linker_ms?: number;
  analyzer_ms?: number;
}

export interface ConvexMetrics {
  convex_queries: number;
  convex_mutations: number;
  convex_actions: number;
}

export interface ApiMetrics {
  api_calls: number;
}

export interface EntityMetrics {
  entities_created: number;
  entities_updated: number;
  entities_deleted: number;
  entities_unchanged: number;
}

export interface ErrorMetrics {
  error_message?: string;
  error_stack?: string;
  retry_count?: number;
}

export interface JobMetrics
  extends StageMetrics,
    ConvexMetrics,
    ApiMetrics,
    EntityMetrics,
    ErrorMetrics {}

/**
 * MetricsCollector class for tracking metrics during job execution
 */
export class MetricsCollector {
  // Stage timings
  private stageTimes = new Map<string, number>();
  private stageStartTimes = new Map<string, number>();

  // Convex function call counts
  private convexQueries = 0;
  private convexMutations = 0;
  private convexActions = 0;

  // API call count
  private apiCalls = 0;

  // Entity changes
  private entitiesCreated = 0;
  private entitiesUpdated = 0;
  private entitiesDeleted = 0;
  private entitiesUnchanged = 0;

  // Error tracking
  private errorDetails: ErrorMetrics = {};

  /**
   * Start timing a stage
   */
  startStage(stageName: string): void {
    this.stageStartTimes.set(stageName, Date.now());
  }

  /**
   * End timing a stage
   */
  endStage(stageName: string): void {
    const startTime = this.stageStartTimes.get(stageName);
    if (startTime) {
      const duration = Date.now() - startTime;
      this.stageTimes.set(stageName, duration);
      this.stageStartTimes.delete(stageName);
    }
  }

  /**
   * Track a Convex query call
   */
  trackQuery(): void {
    this.convexQueries++;
  }

  /**
   * Track a Convex mutation call
   */
  trackMutation(): void {
    this.convexMutations++;
  }

  /**
   * Track a Convex action call
   */
  trackAction(): void {
    this.convexActions++;
  }

  /**
   * Track an external API call
   */
  trackApiCall(): void {
    this.apiCalls++;
  }

  /**
   * Track entity creation
   */
  trackEntityCreated(count: number = 1): void {
    this.entitiesCreated += count;
  }

  /**
   * Track entity update
   */
  trackEntityUpdated(count: number = 1): void {
    this.entitiesUpdated += count;
  }

  /**
   * Track entity deletion
   */
  trackEntityDeleted(count: number = 1): void {
    this.entitiesDeleted += count;
  }

  /**
   * Track entity unchanged (no update needed)
   */
  trackEntityUnchanged(count: number = 1): void {
    this.entitiesUnchanged += count;
  }

  /**
   * Track error details
   */
  trackError(error: Error, retryCount?: number): void {
    this.errorDetails = {
      error_message: error.message,
      error_stack: error.stack,
      retry_count: retryCount,
    };
  }

  /**
   * Get all collected metrics
   */
  getMetrics(): JobMetrics {
    return {
      // Stage durations
      adapter_ms: this.stageTimes.get("adapter"),
      processor_ms: this.stageTimes.get("processor"),
      linker_ms: this.stageTimes.get("linker"),
      analyzer_ms: this.stageTimes.get("analyzer"),

      // Convex function calls
      convex_queries: this.convexQueries,
      convex_mutations: this.convexMutations,
      convex_actions: this.convexActions,

      // API calls
      api_calls: this.apiCalls,

      // Entity changes
      entities_created: this.entitiesCreated,
      entities_updated: this.entitiesUpdated,
      entities_deleted: this.entitiesDeleted,
      entities_unchanged: this.entitiesUnchanged,

      // Error details
      ...this.errorDetails,
    };
  }

  /**
   * Reset all metrics (useful for reusing the collector)
   */
  reset(): void {
    this.stageTimes.clear();
    this.stageStartTimes.clear();
    this.convexQueries = 0;
    this.convexMutations = 0;
    this.convexActions = 0;
    this.apiCalls = 0;
    this.entitiesCreated = 0;
    this.entitiesUpdated = 0;
    this.entitiesDeleted = 0;
    this.entitiesUnchanged = 0;
    this.errorDetails = {};
  }

  /**
   * Merge metrics from another collector (useful for combining parallel operations)
   */
  merge(other: MetricsCollector): void {
    const otherMetrics = other.getMetrics();

    // Merge stage durations (sum them)
    if (otherMetrics.adapter_ms) {
      this.stageTimes.set(
        "adapter",
        (this.stageTimes.get("adapter") || 0) + otherMetrics.adapter_ms,
      );
    }
    if (otherMetrics.processor_ms) {
      this.stageTimes.set(
        "processor",
        (this.stageTimes.get("processor") || 0) + otherMetrics.processor_ms,
      );
    }
    if (otherMetrics.linker_ms) {
      this.stageTimes.set(
        "linker",
        (this.stageTimes.get("linker") || 0) + otherMetrics.linker_ms,
      );
    }
    if (otherMetrics.analyzer_ms) {
      this.stageTimes.set(
        "analyzer",
        (this.stageTimes.get("analyzer") || 0) + otherMetrics.analyzer_ms,
      );
    }

    // Merge counts (sum them)
    this.convexQueries += otherMetrics.convex_queries;
    this.convexMutations += otherMetrics.convex_mutations;
    this.convexActions += otherMetrics.convex_actions;
    this.apiCalls += otherMetrics.api_calls;
    this.entitiesCreated += otherMetrics.entities_created;
    this.entitiesUpdated += otherMetrics.entities_updated;
    this.entitiesDeleted += otherMetrics.entities_deleted;
    this.entitiesUnchanged += otherMetrics.entities_unchanged;

    // Merge error details (keep first error)
    if (otherMetrics.error_message && !this.errorDetails.error_message) {
      this.errorDetails = {
        error_message: otherMetrics.error_message,
        error_stack: otherMetrics.error_stack,
        retry_count: otherMetrics.retry_count,
      };
    }
  }

  /**
   * Serialize metrics to JSON for queue transport
   * Returns metrics in JobMetrics format
   */
  toJSON(): any {
    return this.getMetrics();
  }

  /**
   * Deserialize metrics from JSON and create MetricsCollector
   * Used to restore metrics from previous stages
   */
  static fromJSON(json: any): MetricsCollector {
    const collector = new MetricsCollector();

    // Restore stage times
    if (json.adapter_ms) collector.stageTimes.set("adapter", json.adapter_ms);
    if (json.processor_ms)
      collector.stageTimes.set("processor", json.processor_ms);
    if (json.linker_ms) collector.stageTimes.set("linker", json.linker_ms);
    if (json.analyzer_ms)
      collector.stageTimes.set("analyzer", json.analyzer_ms);

    // Restore counts
    collector.convexQueries = json.convex_queries || 0;
    collector.convexMutations = json.convex_mutations || 0;
    collector.convexActions = json.convex_actions || 0;
    collector.apiCalls = json.api_calls || 0;
    collector.entitiesCreated = json.entities_created || 0;
    collector.entitiesUpdated = json.entities_updated || 0;
    collector.entitiesDeleted = json.entities_deleted || 0;
    collector.entitiesUnchanged = json.entities_unchanged || 0;

    // Restore error details
    if (json.error_message) {
      collector.errorDetails = {
        error_message: json.error_message,
        error_stack: json.error_stack,
        retry_count: json.retry_count,
      };
    }

    return collector;
  }
}
