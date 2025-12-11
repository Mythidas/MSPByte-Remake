import { PerformanceTracker } from "@workspace/shared/lib/performance.js";
import { api } from "@workspace/database/convex/_generated/api.js";
import { client } from "@workspace/shared/lib/convex.js";

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
  performanceTracker: PerformanceTracker,
): Promise<void> {
  if (result.statusCode === 200) {
    return;
  }

  try {
    const spans = performanceTracker.getSpans();
    const totalElapsed = performanceTracker.getTotalElapsed();

    await client.mutation(api.agents.mutate_s.createApiLog, {
      endpoint: context.endpoint,
      method: context.method,
      agentId: context.agentId as any,
      siteId: context.siteId as any,
      tenantId: context.tenantId as any,
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
      secret: process.env.CONVEX_API_KEY!,
    });
  } catch (error) {
    // Don't fail the request if logging fails
    console.error("Failed to log agent API call:", error);
  }
}
