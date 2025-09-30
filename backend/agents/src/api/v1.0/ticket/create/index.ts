import { HaloPSAConnector } from "@workspace/shared/lib/connectors/HaloPSAConnector.js";
import { getRow } from "@workspace/shared/lib/db/orm.js";
import Debug from "@workspace/shared/lib/Debug.js";
import { generateUUID } from "@workspace/shared/lib/utils.js";
import { HaloPSAConfig } from "@workspace/shared/types/integrations/halopsa/index.js";
import { FastifyInstance } from "fastify";
import { PerformanceTracker } from "@workspace/shared/lib/performance.js";
import { logAgentApiCall } from "@/lib/agentLogger.js";

export default async function (fastify: FastifyInstance) {
  fastify.post("/", async (req) => {
    const perf = new PerformanceTracker();
    let statusCode = 500;
    let ticketID: string | null = null;
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
              module: "v1.0/ticket/create",
              context: "POST",
              message: "API headers invalid",
              code: "401",
            },
          },
          401
        );
      }

      // Fetch agent, site, and data source from database
      const [{ data: agent }, { data: site }, { data: dataSource }] =
        await perf.trackSpan("db_fetch_records", async () => {
          const [agentRes, siteRes] = await Promise.all([
            getRow("agents", {
              filters: [["id", "eq", deviceID]],
            }),
            getRow("sites", {
              filters: [["id", "eq", siteID]],
            }),
          ]);

          // TODO: Hard coded for current implementation... Will need a tenant settings or site settings to determine proper PSA
          const dataSourceRes = await getRow("data_sources", {
            filters: [
              ["integration_id", "eq", "halopsa"],
              ["site_id", "eq", generateUUID(true)],
            ],
          });

          return [agentRes, siteRes, dataSourceRes];
        });

      if (!dataSource || !site || !agent) {
        statusCode = 404;
        errorMessage = "PSA records not valid";
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

      Debug.log({
        module: "v1.0/ticket/create",
        context: "POST",
        message: `Creating ticket for agent ${agent.hostname} (DeviceID: ${agent.id}) (SiteID: ${siteID})`,
      });

      const connector = new HaloPSAConnector(
        dataSource.config as HaloPSAConfig
      );

      // Parse and validate request body
      const body = perf.trackSpanSync("parse_request_body", () => {
        return JSON.parse(req.body as string) as {
          screenshot?: {
            name?: string;
            data?: string;
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
      });

      // Fetch assets from PSA
      const { data: assets } = await perf.trackSpan(
        "psa_fetch_assets",
        async () => {
          if (!body.rmm_id) {
            return { data: [] };
          }
          return await connector.getAssets(site?.psa_company_id || "");
        }
      );

      if (!assets) {
        statusCode = 404;
        errorMessage = "Failed to fetch halo assets";
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

      Debug.log({
        module: "v1.0/ticket/create",
        context: "POST",
        message: `Found ${assets.length} HaloPSAAssets (HaloSiteID: ${site.psa_company_id})`,
      });

      // Find matching asset
      const asset = perf.trackSpanSync("find_matching_asset", () => {
        return assets.find((a) => {
          if (body.rmm_id) {
            return a.datto_id === body.rmm_id;
          }

          return a.inventory_number === agent.hostname;
        });
      });

      if (asset) {
        Debug.log({
          module: "v1.0/ticket/create",
          context: "POST",
          message: `HaloAsset found for ${agent.hostname} (HaloID: ${asset?.id})`,
        });
      }

      // Upload screenshot if provided
      if (body.screenshot && body.screenshot.data && body.screenshot.name) {
        await perf.trackSpan("psa_upload_screenshot", async () => {
          const binary = atob(body.screenshot!.data!);
          const len = binary.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
            bytes[i] = binary.charCodeAt(i);
          }

          const blob = new Blob([bytes], { type: "image/png" });
          const { data } = await connector.uploadImage(blob);
          if (data) {
            body.link = data;

            Debug.log({
              module: "v1.0/ticket/create",
              context: "POST",
              message: `Image uploaded to HaloPSA for ${agent.hostname} (Link: ${body.link})`,
            });
          }
        });
      }

      // Create ticket in PSA
      const { data: createdTicketID } = await perf.trackSpan(
        "psa_create_ticket",
        async () => {
          return await connector.createTicket({
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
        }
      );

      if (!createdTicketID) {
        statusCode = 500;
        errorMessage = "Failed to create ticket";
        return Debug.response(
          {
            error: {
              module: "v1.0/ticket/create",
              context: "POST",
              message: "Failed to create ticket",
              code: "500",
            },
          },
          500
        );
      }

      ticketID = createdTicketID;

      Debug.log({
        module: "v1.0/ticket/create",
        context: "POST",
        message: `Ticket create in HaloPSA for ${agent.hostname} (TicketID: ${ticketID})`,
      });

      statusCode = 200;

      // Log successful API call
      await logAgentApiCall(
        {
          endpoint: "/v1.0/ticket/create",
          method: "POST",
          deviceId: deviceID,
          siteId: siteID,
          tenantId: agent.tenant_id,
          psaSiteId: site.psa_company_id || undefined,
          rmmDeviceId: body.rmm_id,
        },
        {
          statusCode: 200,
          externalId: String(ticketID),
          requestMetadata: {
            summary: body.summary,
            impact: body.impact,
            urgency: body.urgency,
            has_screenshot: !!body.screenshot,
          },
          responseMetadata: {
            ticket_id: ticketID,
          },
        },
        perf
      );

      return Debug.response(
        {
          data: ticketID,
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
          const { data: agent } = await getRow("agents", {
            filters: [["id", "eq", deviceID]],
          });

          if (agent) {
            await logAgentApiCall(
              {
                endpoint: "/v1.0/ticket/create",
                method: "POST",
                deviceId: deviceID,
                siteId: siteID,
                tenantId: agent.tenant_id,
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
            module: "v1.0/ticket/create",
            context: "POST",
            message: `Failed to create ticket: ${err}`,
            code: "500",
          },
        },
        500
      );
    }
  });
}
