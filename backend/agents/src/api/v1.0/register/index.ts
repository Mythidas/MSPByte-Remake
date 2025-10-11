import { generateAgentGuid } from "@/lib/utils.js";
import { api } from "@workspace/database/convex/_generated/api.js";
import { client } from "@workspace/shared/lib/db/convex.js";
import Debug from "@workspace/shared/lib/Debug.js";
import { FastifyInstance } from "fastify";

export default async function (fastify: FastifyInstance) {
  fastify.post("/", async (req) => {
    const { site_id, hostname, version, guid, mac, platform } =
      req.body as string as {
        site_id?: string;
        hostname?: string;
        version?: string;
        guid?: string;
        platform?: string;
        mac?: string;
      };

    if (!site_id || !hostname || !version || !platform) {
      return Debug.response(
        {
          error: {
            module: "v1.0/register",
            context: "POST",
            message:
              "Site, Hostname, Platform and Version are required for registration",
            code: "400",
          },
        },
        400
      );
    }

    const site = await client.action(api.sites.internal.get, {
      id: site_id as any,
      secret: process.env.CONVEX_API_KEY!,
    });

    if (!site) {
      return Debug.response(
        {
          error: {
            module: "v1.0/register",
            context: "POST",
            message: "Invalid site_uid provided",
            code: "400",
          },
        },
        400
      );
    }

    // Generate GUID using the new utility function
    const calculatedGuid = generateAgentGuid(guid, mac, hostname, site._id);
    const agent = await client.action(api.agents.internal.getByGuid, {
      guid: guid || "",
      secret: process.env.CONVEX_API_KEY!,
    });

    const result = !agent
      ? await client.action(api.agents.internal.create, {
          tenantId: site.tenantId,
          siteId: site._id,
          guid: calculatedGuid,
          hostname,
          platform,
          version,
          secret: process.env.CONVEX_API_KEY!,
        })
      : await client.action(api.agents.internal.update, {
          id: agent._id,
          siteId: site._id,
          guid: calculatedGuid,
          hostname,
          platform,
          version,
          secret: process.env.CONVEX_API_KEY!,
        });

    if (!result) {
      return Debug.response(
        {
          error: {
            module: "v1.0/register",
            context: "POST",
            message: "Failed to create agent",
            code: "500",
          },
        },
        500
      );
    }

    return Debug.response(
      {
        data: {
          device_id: result._id,
          guid: result.guid,
        },
      },
      200
    );
  });
}
