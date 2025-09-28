import { HaloPSAConnector } from "@workspace/shared/lib/connectors/HaloPSAConnector";
import { getRow } from "@workspace/shared/lib/db/orm";
import Debug from "@workspace/shared/lib/Debug";
import Encryption from "@workspace/shared/lib/Encryption";
import { generateUUID } from "@workspace/shared/lib/utils";
import { HaloPSAConfig } from "@workspace/shared/types/integrations/halopsa";
import { FastifyInstance } from "fastify";

export default async function (fastify: FastifyInstance) {
  fastify.post("/", async (req) => {
    const apiKey = req.headers["x-api-key"] as string;
    if (!apiKey || !apiKey.startsWith("Bearer ")) {
      return Debug.response(
        {
          error: {
            module: "v1.0/ticket/create",
            context: "POST",
            message: "API key invalid format",
            code: "401",
          },
        },
        401
      );
    }

    const apiKeyHash = Encryption.sha256(apiKey.replace("Bearer ", "").trim());
    const { data: agentKey, error: agentKeyError } = await getRow(
      "agent_keys",
      {
        filters: [
          ["key_hash", "eq", apiKeyHash],
          ["active", "eq", "true"],
        ],
      }
    );

    if (agentKeyError) {
      return Debug.response(
        {
          error: {
            module: "v1.0/ticket/create",
            context: "POST",
            message: "API key invalid or stale",
            code: "401",
          },
        },
        401
      );
    }

    const { data: agent } = await getRow("agents", {
      filters: [["id", "eq", agentKey.agent_id]],
    });

    const { data: site } = await getRow("sites", {
      filters: [["id", "eq", agentKey.site_id]],
    });

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
    const { data: assets } = await connector.getAssets(site.psa_company_id);
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
        content: string;
        name: string;
      };
      link?: string;
      summary: string;
      description?: string;

      name: string;
      email: string;
      phone: string;

      impact: string;
      urgency: string;

      rmm_uid?: string;
    };

    const asset = assets.find((a) => {
      if (body.rmm_uid) {
        return a.datto_id === body.rmm_uid;
      }

      return a.inventory_number === agent.hostname;
    });

    if (body.screenshot) {
      const binary = atob(body.screenshot.content);
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

    return new Response(ticketID, {
      status: 200,
      headers: {
        Connection: "close", // important to prevent chunked
      },
    });
  });
}
