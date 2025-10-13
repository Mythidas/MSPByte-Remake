import Debug from "@workspace/shared/lib/Debug.js";
import { FastifyInstance } from "fastify";
import { PerformanceTracker } from "@workspace/shared/lib/performance.js";
import { logAgentApiCall } from "@/lib/agentLogger.js";
import { generateAgentGuid, isVersionGte } from "@/lib/utils.js";
import { api } from "@workspace/database/convex/_generated/api.js";
import { Doc } from "@workspace/database/convex/_generated/dataModel.js";
import { client } from "@workspace/shared/lib/convex.js";
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
              code: "401",
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
              code: "400",
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

      // Fetch agent metadata from Convex (only for validation and metadata comparison)
      const existingAgent = (await perf.trackSpan(
        "db_fetch_agent",
        async () => {
          return client.query(api.agents.crud_s.get, {
            id: deviceID as any,
            secret: process.env.CONVEX_API_KEY!,
          });
        }
      )) as Doc<"agents">;

      if (!existingAgent) {
        statusCode = 404;
        errorMessage = "Agent not found";
        return Debug.response(
          {
            error: {
              module: "v1.0/heartbeat",
              context: "POST",
              message: "Agent not found",
              code: "404",
            },
          },
          404
        );
      }

      // Record heartbeat in Redis (fast, no DB write)
      const heartbeatManager = getHeartbeatManager();
      await perf.trackSpan("record_heartbeat_redis", async () => {
        await heartbeatManager.recordHeartbeat(deviceID as any);
      });

      Debug.log({
        module: "v1.0/heartbeat",
        context: "POST",
        message: `Heartbeat from agent ${hostname} (DeviceID: ${deviceID}) (GUID: ${calculatedGuid})`,
      });

      // Check if metadata has changed - only update Convex if needed
      const metadataChanged =
        existingAgent.guid !== calculatedGuid ||
        existingAgent.hostname !== hostname ||
        existingAgent.version !== version ||
        (ip_address && existingAgent.ipAddress !== ip_address) ||
        (ext_address && existingAgent.extAddress !== ext_address) ||
        (mac_address && existingAgent.macAddress !== mac_address);

      if (metadataChanged) {
        Debug.log({
          module: "v1.0/heartbeat",
          context: "POST",
          message: `Agent metadata changed for ${deviceID}, updating Convex`,
        });

        // Update agent metadata in Convex
        await perf.trackSpan("db_update_agent_metadata", async () => {
          await client.mutation(api.agents.crud_s.update, {
            id: deviceID as any,
            updates: {
              guid: calculatedGuid,
              hostname,
              ipAddress: ip_address || existingAgent.ipAddress,
              extAddress: ext_address || existingAgent.extAddress,
              version,
              macAddress: mac_address || existingAgent.macAddress,
              statusChangedAt: new Date().getTime(),
            },
            secret: process.env.CONVEX_API_KEY!,
          });
        });
      }

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
        // Get tenant_id for logging (best effort)
        try {
          const agent = (await perf.trackSpan("db_fetch_agent", async () => {
            return client.query(api.agents.crud_s.get, {
              id: deviceID as any,
              secret: process.env.CONVEX_API_KEY!,
            });
          })) as Doc<"agents">;

          if (agent) {
            await logAgentApiCall(
              {
                endpoint: "/v1.0/heartbeat",
                method: "POST",
                agentId: agent._id,
                siteId: siteID as any,
                tenantId: agent.tenantId,
              },
              {
                statusCode,
                errorMessage,
              },
              perf
            );
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
            code: "500",
          },
        },
        500
      );
    }
  });
}
