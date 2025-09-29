import { HaloPSAConnector } from "@workspace/shared/lib/connectors/HaloPSAConnector.js";
import { getRow } from "@workspace/shared/lib/db/orm.js";
import Debug from "@workspace/shared/lib/Debug.js";
import Encryption from "@workspace/shared/lib/Encryption.js";
import { generateUUID } from "@workspace/shared/lib/utils.js";
import { HaloPSAConfig } from "@workspace/shared/types/integrations/halopsa/index.js";
import { FastifyInstance } from "fastify";

export default async function (fastify: FastifyInstance) {
  fastify.post("/", async (req) => {
    const siteID = req.headers["x-site-id"] as string;
    const deviceID = req.headers["x-device-id"] as string;
    if (!siteID || !deviceID) {
      return Debug.response(
        {
          error: {
            module: "v1.0/ticket/create",
            context: "POST",
            message: "API headers invalid",
            code: "401",
          },
        },
        401
      );
    }

    const [{ data: agent }, { data: site }] = await Promise.all([
      getRow("agents", {
        filters: [["id", "eq", deviceID]],
      }),
      getRow("sites", {
        filters: [["id", "eq", siteID]],
      }),
    ]);

    // TODO: Hard coded for current implementation... Will need a tenant settings or site settings to determine proper PSA
    const { data: dataSource } = await getRow("data_sources", {
      filters: [
        ["integration_id", "eq", "halopsa"],
        ["site_id", "eq", generateUUID(true)],
      ],
    });

    if (!dataSource || !site || !agent) {
      return Debug.response(
        {
          error: {
            module: "v1.0/ticket/create",
            context: "POST",
            message: "PSA records not valid",
            code: "401",
          },
        },
        404
      );
    }

    const connector = new HaloPSAConnector(dataSource.config as HaloPSAConfig);
    const { data: assets } = await connector.getAssets(
      site?.psa_company_id || ""
    );
    if (!assets) {
      return Debug.response(
        {
          error: {
            module: "v1.0/ticket/create",
            context: "POST",
            message: "Failed to fetch halo assets",
            code: "404",
          },
        },
        404
      );
    }

    const body = JSON.parse(req.body as string) as {
      screenshot?: {
        name: string;
        data: string;
      };
      link?: string;
      summary: string;
      description?: string;

      name: string;
      email: string;
      phone: string;

      impact: string;
      urgency: string;

      rmm_id?: string;
    };

    const asset = assets.find((a) => {
      if (body.rmm_id) {
        return a.datto_id === body.rmm_id;
      }

      return a.inventory_number === agent.hostname;
    });

    if (body.screenshot) {
      const binary = atob(body.screenshot.data);
      const len = binary.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binary.charCodeAt(i);
      }

      const blob = new Blob([bytes], { type: "image/png" });
      const { data } = await connector.uploadImage(blob);
      if (data) body.link = data;
    }

    const { data: ticketID } = await connector.createTicket({
      siteId: Number(site.psa_company_id),
      clientId: Number(site.psa_parent_company_id),
      summary: body.summary,
      details: body.description || "",
      user: {
        name: body.name,
        email: body.email,
        phone: body.phone,
      },
      impact: body.impact,
      urgency: body.urgency,
      assets: asset ? [asset.id] : [], // TODO: Find assets,
      images: body.link ? [body.link] : [],
    });

    if (!ticketID) {
      return Debug.response(
        {
          error: {
            module: "v1.0/ticket/create",
            context: "POST",
            message: "Failed to create ticket",
            code: "500",
          },
        },
        404
      );
    }

    return Debug.response(
      {
        data: ticketID,
      },
      200
    );
  });
}
