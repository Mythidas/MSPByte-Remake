import { generateAgentGuid } from "@/lib/utils.js";
import { api } from "@workspace/database/convex/_generated/api.js";
import { Doc } from "@workspace/database/convex/_generated/dataModel.js";
import { client } from "@workspace/shared/lib/convex.js";
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

    const site = (await client.query(api.helpers.orm.get_s, {
      tableName: "sites",
      id: site_id as any,
      secret: process.env.CONVEX_API_KEY!,
    })) as Doc<"sites">;

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
    const agent = await client.query(api.helpers.orm.get_s, {
      tableName: "agents",
      secret: process.env.CONVEX_API_KEY!,
      index: {
        name: "by_guid",
        params: { guid: calculatedGuid },
      },
    });

    const result = !agent
      ? await client.mutation(api.helpers.orm.insert_s, {
          tableName: "agents",
          data: {
            siteId: site._id,
            guid: calculatedGuid,
            hostname,
            platform,
            version,
          },
          tenantId: site.tenantId,
          secret: process.env.CONVEX_API_KEY!,
        })
      : await client.mutation(api.helpers.orm.update_s, {
          tableName: "agents",
          data: [
            {
              id: agent._id,
              updates: {
                siteId: site._id,
                guid: calculatedGuid,
                hostname,
                version,
              },
            },
          ],
          secret: process.env.CONVEX_API_KEY!,
        });

    if (!result || !result.length) {
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
          device_id: result[0],
          guid: calculatedGuid,
        },
      },
      200
    );
  });
}
