import Debug from "@workspace/shared/lib/Debug.js";
import { FastifyInstance } from "fastify";
import { PerformanceTracker } from "@workspace/shared/lib/performance.js";
import { generateAgentGuid, isVersionGte } from "@/lib/utils.js";
import { getHeartbeatManager } from "@/lib/heartbeatManager.js";

const COMPATIBLE_AGENT_VERSION = "0.1.11";

export default async function (fastify: FastifyInstance) {
  fastify.post("/", async (req) => {
    const perf = new PerformanceTracker();
    let statusCode = 500;
    let errorMessage: string | undefined;

    try {
      const siteID = req.headers["x-site-id"] as string;
      const deviceID = req.headers["x-device-id"] as string;

      // Validate headers
      await perf.trackSpan("validate_headers", async () => {
        if (!siteID || !deviceID) {
          throw new Error("API headers invalid");
        }
      });

      if (!siteID || !deviceID) {
        statusCode = 401;
        errorMessage = "API headers invalid";
        return Debug.response(
          {
            error: {
              module: "v1.0/heartbeat",
              context: "POST",
              message: "API headers invalid",
            },
          },
          401
        );
      }

      // Parse request body
      const {
        hostname,
        ip_address,
        ext_address,
        version,
        mac_address,
        guid: agentGuid,
      } = req.body as {
        hostname?: string;
        ip_address?: string;
        ext_address?: string;
        version?: string;
        mac_address?: string;
        guid?: string;
      };

      if (
        !hostname ||
        !version ||
        !isVersionGte(version, COMPATIBLE_AGENT_VERSION)
      ) {
        statusCode = 400;
        errorMessage = "Hostname and version are required";
        return Debug.response(
          {
            error: {
              module: "v1.0/heartbeat",
              context: "POST",
              message: "Hostname and version are required",
            },
          },
          400
        );
      }

      // Generate GUID using the new function
      const calculatedGuid = generateAgentGuid(
        agentGuid,
        mac_address,
        hostname,
        siteID
      );

      // Get heartbeat manager
      const heartbeatManager = getHeartbeatManager();

      // Check if agent exists in cache (fast Redis lookup, or single Convex fetch on cache miss)
      const cachedAgent = await perf.trackSpan(
        "get_or_fetch_agent",
        async () => {
          return await heartbeatManager.getOrFetchAgent(deviceID as any);
        }
      );

      if (!cachedAgent) {
        statusCode = 404;
        errorMessage = "Agent not found";
        return Debug.response(
          {
            error: {
              module: "v1.0/heartbeat",
              context: "POST",
              message: "Agent not found",
            },
          },
          404
        );
      }

      // Record heartbeat with metadata in Redis
      // HeartbeatManager will detect changes and queue updates for batching
      await perf.trackSpan("record_heartbeat_redis", async () => {
        await heartbeatManager.recordHeartbeat(deviceID as any, {
          guid: calculatedGuid,
          hostname,
          version,
          ipAddress: ip_address,
          extAddress: ext_address,
          macAddress: mac_address,
        });
      });

      statusCode = 200;

      return Debug.response(
        {
          data: {
            guid: calculatedGuid,
          },
        },
        200
      );
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : String(err);

      // Log failed API call
      const siteID = req.headers["x-site-id"] as string;
      const deviceID = req.headers["x-device-id"] as string;

      if (siteID && deviceID) {
        // Try to get agent from cache for logging (best effort)
        try {
          const heartbeatManager = getHeartbeatManager();
          const cachedAgent = await heartbeatManager.getOrFetchAgent(
            deviceID as any
          );

          if (cachedAgent) {
            // Note: We don't have full agent data in cachedAgent, so we skip detailed logging
            Debug.log({
              module: "v1.0/heartbeat",
              context: "POST:error",
              message: `Heartbeat failed for agent ${deviceID}: ${errorMessage}`,
            });
          }
        } catch {
          // Ignore logging errors
        }
      }

      return Debug.response(
        {
          error: {
            module: "v1.0/heartbeat",
            context: "POST",
            message: `Failed to process heartbeat: ${err}`,
          },
        },
        500
      );
    }
  });
}
