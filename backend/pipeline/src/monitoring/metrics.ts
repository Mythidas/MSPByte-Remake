/**
 * Monitoring Metrics - Phase 7
 *
 * Provides Prometheus-compatible metrics for pipeline monitoring:
 * - Pipeline execution metrics (counts, durations, errors)
 * - Query performance metrics (from DataContextLoader)
 * - Alert metrics (created, resolved, active)
 * - Feature flag status
 * - Job queue metrics
 *
 * Usage:
 *   import { MetricsCollector } from './monitoring/metrics.js';
 *   const metrics = MetricsCollector.getInstance();
 *   metrics.recordPipelineExecution('success', 45000);
 *   const report = metrics.getMetricsReport();
 */

import type { Id } from "@workspace/database/convex/_generated/dataModel.js";
import Logger from "../lib/logger.js";
import { FeatureFlagManager } from "../lib/featureFlags.js";

export type PipelineStage =
  | "adapter" // Data ingestion from external source
  | "processor" // Entity processing and normalization
  | "linker" // Relationship linking
  | "analyzer" // Analysis execution
  | "alert"; // Alert creation/resolution

export type PipelineStatus = "success" | "error" | "timeout";

export interface PipelineMetric {
  stage: PipelineStage;
  status: PipelineStatus;
  durationMs: number;
  timestamp: number;
  tenantId?: Id<"tenants">;
  dataSourceId?: Id<"data_sources">;
  errorMessage?: string;
}

export interface QueryMetric {
  queryType: string; // "loadEntities", "loadRelationships", etc.
  durationMs: number;
  timestamp: number;
  isSlow: boolean; // >100ms
}

export interface AlertMetric {
  action: "created" | "resolved" | "suppressed";
  alertType: string;
  severity: "low" | "medium" | "high" | "critical";
  timestamp: number;
  tenantId?: Id<"tenants">;
}

export interface MetricsSummary {
  // Pipeline metrics
  totalPipelineExecutions: number;
  pipelineSuccessCount: number;
  pipelineErrorCount: number;
  pipelineTimeoutCount: number;
  averagePipelineDurationMs: number;

  // Query metrics
  totalQueries: number;
  slowQueryCount: number;
  averageQueryDurationMs: number;

  // Alert metrics
  totalAlertsCreated: number;
  totalAlertsResolved: number;
  totalAlertsSuppressed: number;
  alertsBySeverity: Record<string, number>;

  // By stage
  metricsByStage: Record<PipelineStage, {
    count: number;
    successCount: number;
    errorCount: number;
    averageDurationMs: number;
  }>;

  // Time range
  collectionStartTime: number;
  lastUpdateTime: number;
}

export interface PrometheusMetric {
  name: string;
  help: string;
  type: "counter" | "gauge" | "histogram";
  value: number | Record<string, number>;
  labels?: Record<string, string>;
}

export class MetricsCollector {
  private static instance: MetricsCollector;

  private pipelineMetrics: PipelineMetric[] = [];
  private queryMetrics: QueryMetric[] = [];
  private alertMetrics: AlertMetric[] = [];

  private collectionStartTime: number;
  private maxMetricsAge: number = 3600000; // 1 hour in ms
  private maxMetricsCount: number = 10000; // Prevent memory bloat

  private constructor() {
    this.collectionStartTime = Date.now();

    // Start periodic cleanup
    setInterval(() => this.cleanup(), 300000); // Every 5 minutes

    Logger.log({
      module: "MetricsCollector",
      context: "initialize",
      message: "Metrics collector initialized",
      metadata: {
        maxAge: this.maxMetricsAge,
        maxCount: this.maxMetricsCount,
      },
    });
  }

  public static getInstance(): MetricsCollector {
    if (!MetricsCollector.instance) {
      MetricsCollector.instance = new MetricsCollector();
    }
    return MetricsCollector.instance;
  }

  /**
   * Record a pipeline execution metric
   */
  public recordPipelineExecution(
    stage: PipelineStage,
    status: PipelineStatus,
    durationMs: number,
    metadata?: {
      tenantId?: Id<"tenants">;
      dataSourceId?: Id<"data_sources">;
      errorMessage?: string;
    }
  ): void {
    const metric: PipelineMetric = {
      stage,
      status,
      durationMs,
      timestamp: Date.now(),
      ...metadata,
    };

    this.pipelineMetrics.push(metric);

    if (status === "error") {
      Logger.log({
        module: "MetricsCollector",
        context: "recordPipelineExecution",
        message: `Pipeline ${stage} failed`,
        level: "error",
        metadata: { durationMs, errorMessage: metadata?.errorMessage },
      });
    }
  }

  /**
   * Record a query performance metric
   */
  public recordQuery(queryType: string, durationMs: number): void {
    const metric: QueryMetric = {
      queryType,
      durationMs,
      timestamp: Date.now(),
      isSlow: durationMs > 100,
    };

    this.queryMetrics.push(metric);

    if (metric.isSlow) {
      Logger.log({
        module: "MetricsCollector",
        context: "recordQuery",
        message: `Slow query detected: ${queryType}`,
        level: "warn",
        metadata: { durationMs },
      });
    }
  }

  /**
   * Record an alert metric
   */
  public recordAlert(
    action: "created" | "resolved" | "suppressed",
    alertType: string,
    severity: "low" | "medium" | "high" | "critical",
    tenantId?: Id<"tenants">
  ): void {
    const metric: AlertMetric = {
      action,
      alertType,
      severity,
      timestamp: Date.now(),
      tenantId,
    };

    this.alertMetrics.push(metric);
  }

  /**
   * Get comprehensive metrics summary
   */
  public getSummary(): MetricsSummary {
    // Pipeline metrics
    const totalPipelineExecutions = this.pipelineMetrics.length;
    const pipelineSuccessCount = this.pipelineMetrics.filter((m) => m.status === "success").length;
    const pipelineErrorCount = this.pipelineMetrics.filter((m) => m.status === "error").length;
    const pipelineTimeoutCount = this.pipelineMetrics.filter((m) => m.status === "timeout").length;

    const totalPipelineDuration = this.pipelineMetrics.reduce((sum, m) => sum + m.durationMs, 0);
    const averagePipelineDurationMs =
      totalPipelineExecutions > 0 ? totalPipelineDuration / totalPipelineExecutions : 0;

    // Query metrics
    const totalQueries = this.queryMetrics.length;
    const slowQueryCount = this.queryMetrics.filter((m) => m.isSlow).length;
    const totalQueryDuration = this.queryMetrics.reduce((sum, m) => sum + m.durationMs, 0);
    const averageQueryDurationMs = totalQueries > 0 ? totalQueryDuration / totalQueries : 0;

    // Alert metrics
    const totalAlertsCreated = this.alertMetrics.filter((m) => m.action === "created").length;
    const totalAlertsResolved = this.alertMetrics.filter((m) => m.action === "resolved").length;
    const totalAlertsSuppressed = this.alertMetrics.filter((m) => m.action === "suppressed").length;

    const alertsBySeverity: Record<string, number> = {
      low: this.alertMetrics.filter((m) => m.severity === "low").length,
      medium: this.alertMetrics.filter((m) => m.severity === "medium").length,
      high: this.alertMetrics.filter((m) => m.severity === "high").length,
      critical: this.alertMetrics.filter((m) => m.severity === "critical").length,
    };

    // Metrics by stage
    const stages: PipelineStage[] = ["adapter", "processor", "linker", "analyzer", "alert"];
    const metricsByStage: Record<PipelineStage, any> = {} as any;

    for (const stage of stages) {
      const stageMetrics = this.pipelineMetrics.filter((m) => m.stage === stage);
      const count = stageMetrics.length;
      const successCount = stageMetrics.filter((m) => m.status === "success").length;
      const errorCount = stageMetrics.filter((m) => m.status === "error").length;
      const totalDuration = stageMetrics.reduce((sum, m) => sum + m.durationMs, 0);
      const averageDurationMs = count > 0 ? totalDuration / count : 0;

      metricsByStage[stage] = {
        count,
        successCount,
        errorCount,
        averageDurationMs,
      };
    }

    return {
      totalPipelineExecutions,
      pipelineSuccessCount,
      pipelineErrorCount,
      pipelineTimeoutCount,
      averagePipelineDurationMs,
      totalQueries,
      slowQueryCount,
      averageQueryDurationMs,
      totalAlertsCreated,
      totalAlertsResolved,
      totalAlertsSuppressed,
      alertsBySeverity,
      metricsByStage,
      collectionStartTime: this.collectionStartTime,
      lastUpdateTime: Date.now(),
    };
  }

  /**
   * Get Prometheus-compatible metrics
   */
  public async getPrometheusMetrics(): Promise<string> {
    const summary = this.getSummary();
    const flags = FeatureFlagManager.getInstance();
    const flagStatuses = flags.getAllStatuses();

    const metrics: string[] = [];

    // Pipeline execution metrics
    metrics.push("# HELP mspbyte_pipeline_executions_total Total number of pipeline executions");
    metrics.push("# TYPE mspbyte_pipeline_executions_total counter");
    metrics.push(`mspbyte_pipeline_executions_total{status="success"} ${summary.pipelineSuccessCount}`);
    metrics.push(`mspbyte_pipeline_executions_total{status="error"} ${summary.pipelineErrorCount}`);
    metrics.push(`mspbyte_pipeline_executions_total{status="timeout"} ${summary.pipelineTimeoutCount}`);
    metrics.push("");

    // Pipeline duration
    metrics.push("# HELP mspbyte_pipeline_duration_ms Average pipeline execution duration in milliseconds");
    metrics.push("# TYPE mspbyte_pipeline_duration_ms gauge");
    metrics.push(`mspbyte_pipeline_duration_ms ${summary.averagePipelineDurationMs.toFixed(2)}`);
    metrics.push("");

    // Query metrics
    metrics.push("# HELP mspbyte_queries_total Total number of database queries");
    metrics.push("# TYPE mspbyte_queries_total counter");
    metrics.push(`mspbyte_queries_total ${summary.totalQueries}`);
    metrics.push("");

    metrics.push("# HELP mspbyte_slow_queries_total Total number of slow queries (>100ms)");
    metrics.push("# TYPE mspbyte_slow_queries_total counter");
    metrics.push(`mspbyte_slow_queries_total ${summary.slowQueryCount}`);
    metrics.push("");

    metrics.push("# HELP mspbyte_query_duration_ms Average query duration in milliseconds");
    metrics.push("# TYPE mspbyte_query_duration_ms gauge");
    metrics.push(`mspbyte_query_duration_ms ${summary.averageQueryDurationMs.toFixed(2)}`);
    metrics.push("");

    // Alert metrics
    metrics.push("# HELP mspbyte_alerts_total Total number of alerts by action");
    metrics.push("# TYPE mspbyte_alerts_total counter");
    metrics.push(`mspbyte_alerts_total{action="created"} ${summary.totalAlertsCreated}`);
    metrics.push(`mspbyte_alerts_total{action="resolved"} ${summary.totalAlertsResolved}`);
    metrics.push(`mspbyte_alerts_total{action="suppressed"} ${summary.totalAlertsSuppressed}`);
    metrics.push("");

    metrics.push("# HELP mspbyte_alerts_by_severity Total alerts by severity");
    metrics.push("# TYPE mspbyte_alerts_by_severity counter");
    for (const [severity, count] of Object.entries(summary.alertsBySeverity)) {
      metrics.push(`mspbyte_alerts_by_severity{severity="${severity}"} ${count}`);
    }
    metrics.push("");

    // Stage metrics
    metrics.push("# HELP mspbyte_stage_executions_total Pipeline stage executions by status");
    metrics.push("# TYPE mspbyte_stage_executions_total counter");
    for (const [stage, data] of Object.entries(summary.metricsByStage)) {
      metrics.push(`mspbyte_stage_executions_total{stage="${stage}",status="success"} ${data.successCount}`);
      metrics.push(`mspbyte_stage_executions_total{stage="${stage}",status="error"} ${data.errorCount}`);
    }
    metrics.push("");

    metrics.push("# HELP mspbyte_stage_duration_ms Average stage duration in milliseconds");
    metrics.push("# TYPE mspbyte_stage_duration_ms gauge");
    for (const [stage, data] of Object.entries(summary.metricsByStage)) {
      metrics.push(`mspbyte_stage_duration_ms{stage="${stage}"} ${data.averageDurationMs.toFixed(2)}`);
    }
    metrics.push("");

    // Feature flag metrics
    metrics.push("# HELP mspbyte_feature_flags Feature flag status (1=enabled, 0=disabled)");
    metrics.push("# TYPE mspbyte_feature_flags gauge");
    for (const flag of flagStatuses) {
      const enabled = flag.globalEnabled ? 1 : 0;
      metrics.push(`mspbyte_feature_flags{flag="${flag.name}"} ${enabled}`);
    }
    metrics.push("");

    metrics.push("# HELP mspbyte_feature_rollout_percentage Feature flag rollout percentage");
    metrics.push("# TYPE mspbyte_feature_rollout_percentage gauge");
    for (const flag of flagStatuses) {
      metrics.push(`mspbyte_feature_rollout_percentage{flag="${flag.name}"} ${flag.rolloutPercentage}`);
    }
    metrics.push("");

    // Uptime
    const uptimeSeconds = (Date.now() - this.collectionStartTime) / 1000;
    metrics.push("# HELP mspbyte_uptime_seconds Time since metrics collection started");
    metrics.push("# TYPE mspbyte_uptime_seconds counter");
    metrics.push(`mspbyte_uptime_seconds ${uptimeSeconds.toFixed(0)}`);
    metrics.push("");

    return metrics.join("\n");
  }

  /**
   * Get JSON metrics report
   */
  public getMetricsReport(): {
    summary: MetricsSummary;
    recentPipeline: PipelineMetric[];
    recentQueries: QueryMetric[];
    recentAlerts: AlertMetric[];
  } {
    const summary = this.getSummary();

    // Get recent metrics (last 100 of each)
    const recentPipeline = this.pipelineMetrics.slice(-100);
    const recentQueries = this.queryMetrics.slice(-100);
    const recentAlerts = this.alertMetrics.slice(-100);

    return {
      summary,
      recentPipeline,
      recentQueries,
      recentAlerts,
    };
  }

  /**
   * Clean up old metrics to prevent memory bloat
   */
  private cleanup(): void {
    const now = Date.now();
    const maxAge = this.maxMetricsAge;

    const pipelineBeforeCount = this.pipelineMetrics.length;
    const queryBeforeCount = this.queryMetrics.length;
    const alertBeforeCount = this.alertMetrics.length;

    // Remove metrics older than maxAge
    this.pipelineMetrics = this.pipelineMetrics.filter((m) => now - m.timestamp < maxAge);
    this.queryMetrics = this.queryMetrics.filter((m) => now - m.timestamp < maxAge);
    this.alertMetrics = this.alertMetrics.filter((m) => now - m.timestamp < maxAge);

    // If still too many, keep only most recent
    if (this.pipelineMetrics.length > this.maxMetricsCount) {
      this.pipelineMetrics = this.pipelineMetrics.slice(-this.maxMetricsCount);
    }
    if (this.queryMetrics.length > this.maxMetricsCount) {
      this.queryMetrics = this.queryMetrics.slice(-this.maxMetricsCount);
    }
    if (this.alertMetrics.length > this.maxMetricsCount) {
      this.alertMetrics = this.alertMetrics.slice(-this.maxMetricsCount);
    }

    const pipelineRemoved = pipelineBeforeCount - this.pipelineMetrics.length;
    const queryRemoved = queryBeforeCount - this.queryMetrics.length;
    const alertRemoved = alertBeforeCount - this.alertMetrics.length;

    if (pipelineRemoved > 0 || queryRemoved > 0 || alertRemoved > 0) {
      Logger.log({
        module: "MetricsCollector",
        context: "cleanup",
        message: "Cleaned up old metrics",
        metadata: {
          pipelineRemoved,
          queryRemoved,
          alertRemoved,
          remaining: {
            pipeline: this.pipelineMetrics.length,
            query: this.queryMetrics.length,
            alert: this.alertMetrics.length,
          },
        },
      });
    }
  }

  /**
   * Reset all metrics
   */
  public reset(): void {
    this.pipelineMetrics = [];
    this.queryMetrics = [];
    this.alertMetrics = [];
    this.collectionStartTime = Date.now();

    Logger.log({
      module: "MetricsCollector",
      context: "reset",
      message: "Reset all metrics",
    });
  }
}

export default MetricsCollector;
