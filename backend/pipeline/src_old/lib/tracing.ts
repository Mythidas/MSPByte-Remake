import { AsyncLocalStorage } from "async_hooks";

export interface TraceContext {
  traceId: string;
  syncId?: string;
  tenantId?: string;
  dataSourceId?: string;
  stage: string;
  startTime: number;
  metadata: Record<string, any>;
}

class TracingManager {
  private static storage = new AsyncLocalStorage<TraceContext>();

  static startTrace(params: {
    syncId?: string;
    tenantId?: string;
    dataSourceId?: string;
    stage: string;
    metadata?: Record<string, any>;
  }): string {
    const traceId = `${params.syncId || "job"}_${params.stage}_${Date.now()}`;

    const context: TraceContext = {
      traceId,
      syncId: params.syncId,
      tenantId: params.tenantId,
      dataSourceId: params.dataSourceId,
      stage: params.stage,
      startTime: Date.now(),
      metadata: params.metadata || {},
    };

    this.storage.enterWith(context);
    return traceId;
  }

  static getContext(): TraceContext | undefined {
    return this.storage.getStore();
  }

  static addMetadata(key: string, value: any): void {
    const context = this.getContext();
    if (context) {
      context.metadata[key] = value;
    }
  }

  static getDuration(): number {
    const context = this.getContext();
    return context ? Date.now() - context.startTime : 0;
  }

  static updateStage(stage: string): void {
    const context = this.getContext();
    if (context) {
      context.stage = stage;
    }
  }
}

export default TracingManager;
