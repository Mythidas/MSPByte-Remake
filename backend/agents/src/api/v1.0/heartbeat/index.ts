import Debug from "@workspace/shared/lib/Debug.js";
import { FastifyInstance } from "fastify";
import { generateAgentGuid } from "@/lib/utils.js";

/**
 * Legacy heartbeat endpoint - maintained for backward compatibility with older agents
 * This endpoint no longer tracks agent status or performs database updates.
 * Agents should be updated to use the registration endpoint for status tracking.
 */
export default async function (fastify: FastifyInstance) {
  fastify.post("/", async (req) => {
    try {
      const siteID = req.headers["x-site-id"] as string;
      const deviceID = req.headers["x-device-id"] as string;

      // Validate headers
      if (!siteID || !deviceID) {
        return Debug.response(
          {
            error: {
              module: "v1.0/heartbeat",
              context: "POST",
              message: "API headers invalid",
            },
          },
          401,
        );
      }

      // Parse request body
      const {
        hostname,
        mac_address,
        guid: agentGuid,
      } = req.body as {
        hostname?: string;
        mac_address?: string;
        guid?: string;
      };

      // Calculate and return GUID for backward compatibility
      const calculatedGuid = generateAgentGuid(
        agentGuid,
        mac_address,
        hostname || "",
        siteID,
      );

      return Debug.response(
        {
          data: {
            guid: calculatedGuid,
          },
        },
        200,
      );
    } catch (err) {
      return Debug.response(
        {
          error: {
            module: "v1.0/heartbeat",
            context: "POST",
            message: `Failed to process heartbeat: ${err}`,
          },
        },
        500,
      );
    }
  });
}
