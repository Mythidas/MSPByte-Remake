import { PerformanceTracker } from "@workspace/shared/lib/performance.js";
import { convexAgents } from "./convex.js";

export interface AgentLogContext {
  endpoint: string;
  method: string; // "GET", "POST", etc.
  agentId: string;
  siteId: string;
  tenantId: string;
  psaSiteId?: string;
  rmmDeviceId?: string;
}

export interface AgentLogResult {
  statusCode: number;
  externalId?: string;
  errorMessage?: string;
  requestMetadata?: Record<string, any>;
  responseMetadata?: Record<string, any>;
}

export async function logAgentApiCall(
  context: AgentLogContext,
  result: AgentLogResult,
  performanceTracker: PerformanceTracker
): Promise<void> {
  if (result.statusCode === 200) {
    return;
  }

  try {
    const spans = performanceTracker.getSpans();
    const totalElapsed = performanceTracker.getTotalElapsed();

    await convexAgents.createApiLog({
      endpoint: context.endpoint,
      method: context.method,
      agentId: context.agentId,
      siteId: context.siteId,
      tenantId: context.tenantId,
      psaSiteId: context.psaSiteId,
      rmmDeviceId: context.rmmDeviceId,
      statusCode: result.statusCode,
      externalId: result.externalId,
      errorMessage: result.errorMessage,
      timeElapsedMs: totalElapsed,
      reqMetadata: result.requestMetadata || {},
      resMetadata: {
        ...((result.responseMetadata || {}) as any),
        spans,
      },
    });
  } catch (error) {
    // Don't fail the request if logging fails
    console.error("Failed to log agent API call:", error);
  }
}
