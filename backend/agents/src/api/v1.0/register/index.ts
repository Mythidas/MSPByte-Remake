import { getRow, upsertRows } from "@workspace/shared/lib/db/orm.js";
import Debug from "@workspace/shared/lib/Debug.js";
import Encryption from "@workspace/shared/lib/Encryption.js";
import { FastifyInstance } from "fastify";

export default async function (fastify: FastifyInstance) {
  fastify.post("/", async (req) => {
    const { site_id, hostname, version, guid, serial, mac, platform } =
      req.body as string as {
        site_id?: string;
        hostname?: string;
        version?: string;
        guid?: string;
        platform?: string;
        serial?: string;
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

    const { data: site } = await getRow("sites", {
      filters: [["id", "eq", site_id]],
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

    const result = await upsertRows("agents", {
      rows: [
        {
          tenant_id: site.tenant_id,
          site_id: site.id,

          // TODO: Make GUID as solid as possible to avoid duplicate devices
          guid:
            guid ||
            Encryption.sha256(JSON.stringify({ hostname, siteID: site.id })),
          hostname: hostname,
          platform: platform,
          ip_address: "",
          ext_address: "",
          online: true,
          version: version,
          mac_address: mac,
        },
      ],
      onConflict: ["guid"],
    });

    if (result.error) {
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
          device_id: result.data[0].id,
          guid: result.data[0].guid,
        },
      },
      200
    );
  });
}
