import Debug from "@workspace/shared/lib/Debug.js";
import TracingManager from "./tracing.js";

interface LogParams {
  module: string;
  context: string;
  message: string;
  level?: "info" | "warn" | "error";
  metadata?: Record<string, any>;
  error?: Error;
}

class Logger {
  static log(params: LogParams): void {
    const trace = TracingManager.getContext();
    const duration = TracingManager.getDuration();

    const logEntry = {
      timestamp: new Date().toISOString(),
      level: params.level || "info",
      module: params.module,
      context: params.context,
      message: params.message,

      // Trace information
      traceId: trace?.traceId,
      syncId: trace?.syncId,
      tenantId: trace?.tenantId,
      dataSourceId: trace?.dataSourceId,
      stage: trace?.stage,
      duration_ms: duration > 0 ? duration : undefined,

      // Metadata
      metadata: {
        ...trace?.metadata,
        ...params.metadata,
      },

      // Error information
      error: params.error
        ? {
            message: params.error.message,
            stack: params.error.stack,
            name: params.error.name,
          }
        : undefined,
    };

    // Use existing Debug module
    if (params.error || params.level === "error") {
      Debug.error(logEntry);
    } else {
      Debug.log(logEntry);
    }
  }

  static startStage(stage: string, metadata?: Record<string, any>): void {
    TracingManager.updateStage(stage);
    this.log({
      module: "Pipeline",
      context: stage,
      message: `Starting ${stage}`,
      metadata,
    });
  }

  static endStage(stage: string, metadata?: Record<string, any>): void {
    const duration = TracingManager.getDuration();
    this.log({
      module: "Pipeline",
      context: stage,
      message: `Completed ${stage}`,
      metadata: {
        ...metadata,
        stage_duration_ms: duration,
      },
    });
  }

  static logQuery(params: {
    tableName: string;
    operation: string;
    recordsAffected?: number;
    duration: number;
  }): void {
    this.log({
      module: "Database",
      context: "query",
      message: `${params.operation} on ${params.tableName}`,
      metadata: {
        table: params.tableName,
        operation: params.operation,
        records: params.recordsAffected,
        query_duration_ms: params.duration,
      },
    });

    // Warn on slow queries
    if (params.duration > 1000) {
      this.log({
        module: "Database",
        context: "slow_query",
        message: `Slow query detected: ${params.operation} on ${params.tableName}`,
        level: "warn",
        metadata: {
          duration_ms: params.duration,
          records: params.recordsAffected,
        },
      });
    }
  }
}

export default Logger;
