import { insertRows } from "@workspace/shared/lib/db/orm.js";
import { PerformanceTracker } from "@workspace/shared/lib/performance.js";
import { Database } from "@workspace/shared/types/database/import.js";

type HttpMethod = Database["public"]["Enums"]["http_method"];

export interface AgentLogContext {
  endpoint: string;
  method: HttpMethod;
  deviceId: string;
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

/**
 * Log an agent API call with performance metrics
 */
export async function logAgentApiCall(
  context: AgentLogContext,
  result: AgentLogResult,
  performanceTracker: PerformanceTracker
): Promise<void> {
  try {
    const spans = performanceTracker.getSpans();
    const totalElapsed = performanceTracker.getTotalElapsed();

    await insertRows("agent_api_logs", {
      rows: [
        {
          endpoint: context.endpoint,
          method: context.method,
          agent_id: context.deviceId,
          site_id: context.siteId,
          tenant_id: context.tenantId,
          psa_site_id: context.psaSiteId || null,
          rmm_device_id: context.rmmDeviceId || null,
          status_code: result.statusCode,
          external_id: result.externalId || null,
          error_message: result.errorMessage || null,
          time_elapsed_ms: totalElapsed,
          req_metadata: result.requestMetadata || {},
          res_metadata: {
            ...((result.responseMetadata || {}) as any),
            spans,
          },
        },
      ],
    });
  } catch (error) {
    // Don't fail the request if logging fails
    console.error("Failed to log agent API call:", error);
  }
}
