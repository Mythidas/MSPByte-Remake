import HaloPSAConnector from "@workspace/shared/lib/connectors/HaloPSAConnector.js";
import Debug from "@workspace/shared/lib/Debug.js";
import { HaloPSAConfig } from "@workspace/shared/types/integrations/halopsa/index.js";
import { FastifyInstance } from "fastify";
import { PerformanceTracker } from "@workspace/shared/lib/performance.js";
import { logAgentApiCall } from "@/lib/agentLogger.js";
import { HaloPSAAsset } from "@workspace/shared/types/integrations/halopsa/assets.js";
import { api } from "@workspace/database/convex/_generated/api.js";
import { client } from "@workspace/shared/lib/convex.js";
import { Doc } from "@workspace/database/convex/_generated/dataModel.js";
import { INTEGRATIONS } from "@workspace/shared/types/integrations/config.js";

export default async function(fastify: FastifyInstance) {
    const CONVEX_API_KEY = process.env.CONVEX_API_KEY!;

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
                        },
                    },
                    401
                );
            }

            // TODO: Implement Convex function to simplify API fetching
            // Fetch agent, site, and data source from database
            const [agent, site, dataSource, psaIntegration] = await perf.trackSpan(
                "db_fetch_records",
                async () => {
                    const [agentRes, siteRes] = (await Promise.all([
                        client.query(api.helpers.orm.get_s, {
                            tableName: "agents",
                            id: deviceID as any,
                            secret: CONVEX_API_KEY,
                        }),
                        client.query(api.helpers.orm.get_s, {
                            tableName: "sites",
                            id: siteID as any,
                            secret: CONVEX_API_KEY,
                        }),
                    ])) as [Doc<"agents">, Doc<"sites">];

                    if (!siteRes || !agentRes) {
                        throw new Error("Resources not found");
                    }

                    const agentSource = (await client.query(api.helpers.orm.get_s, {
                        tableName: "data_sources",
                        tenantId: siteRes.tenantId,
                        secret: CONVEX_API_KEY,
                        index: {
                            name: "by_integration_primary",
                            params: {
                                integrationId: "msp-agent",
                                isPrimary: true,
                            },
                        },
                    })) as Doc<"data_sources">;

                    if (!agentSource) {
                        throw new Error("Agent data source not found");
                    }

                    const psaIntegrationId = agentSource.config?.psaIntegrationId;
                    if (!psaIntegrationId) {
                        return [agentRes, siteRes, null, null];
                    }

                    const dataSourceRes = (await client.query(api.helpers.orm.get_s, {
                        tableName: "data_sources",
                        tenantId: siteRes.tenantId,
                        secret: CONVEX_API_KEY,
                        index: {
                            name: "by_integration_primary",
                            params: {
                                integrationId: psaIntegrationId as any,
                                isPrimary: true,
                            },
                        },
                    })) as Doc<"data_sources">;

                    // Fetch PSA integration to get the slug (psaType)
                    const psaIntegrationRes = INTEGRATIONS[psaIntegrationId];

                    return [agentRes, siteRes, dataSourceRes, psaIntegrationRes];
                }
            );

            if (!dataSource || !site || !agent || !psaIntegration) {
                statusCode = 404;
                errorMessage = "PSA records not valid";
                return Debug.response(
                    {
                        error: {
                            module: "v1.0/ticket/create",
                            context: "POST",
                            message: "PSA records not valid",
                        },
                    },
                    404
                );
            }

            Debug.log({
                module: "v1.0/ticket/create",
                context: "POST",
                message: `Creating ticket for agent ${agent.hostname} (DeviceID: ${agent._id}) (SiteID: ${siteID})`,
            });

            const connector = new HaloPSAConnector(
                dataSource.config as HaloPSAConfig,
                process.env.SECRET_KEY!
            );

            // Parse and validate request body (multipart/form-data or JSON)
            const body = await perf.trackSpan("parse_request_body", async () => {
                const contentType = req.headers["content-type"] || "";

                // Handle multipart/form-data
                if (contentType.includes("multipart/form-data")) {
                    const formData: Record<string, any> = {};
                    let screenshotFile: { filename: string; data: Buffer } | null = null;

                    // Check if req has multipart method
                    if (!req.isMultipart || !req.isMultipart()) {
                        throw new Error("Request is not multipart");
                    }

                    const parts = req.parts();

                    for await (const part of parts) {
                        if (part.type === "file") {
                            if (part.fieldname === "screenshot") {
                                const chunks: Buffer[] = [];
                                for await (const chunk of part.file) {
                                    chunks.push(chunk);
                                }
                                screenshotFile = {
                                    filename: part.filename,
                                    data: Buffer.concat(chunks),
                                };
                            }
                        } else {
                            // Field type - has value property
                            formData[part.fieldname] = (part as any).value;
                        }
                    }

                    // If screenshot file exists, add it to formData
                    if (screenshotFile) {
                        formData.screenshot = {
                            name: screenshotFile.filename,
                            data: screenshotFile.data.toString("base64"),
                        };
                    }

                    return formData as {
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
                }

                // Handle JSON (legacy support)
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
            const assetResponse = await perf.trackSpan(
                "psa_fetch_assets",
                async () => {
                    if (!body.rmm_id) {
                        return { data: [] };
                    }
                    return await connector.getAssets(site?.psaCompanyId || "");
                }
            );

            if ("error" in assetResponse) {
                Debug.log({
                    module: "v1.0/ticket/create",
                    context: "psa_fetch_assets",
                    message: "Failed to fetch assets from PSA",
                });
                return;
            }

            const { data: assets } = assetResponse;

            if (!assets) {
                Debug.log({
                    module: "v1.0/ticket/create",
                    context: "POST",
                    message: "Failed to fetch halo assets",
                });
            }

            Debug.log({
                module: "v1.0/ticket/create",
                context: "POST",
                message: `Found ${assets?.length || 0} HaloPSAAssets (HaloSiteID: ${site.psaCompanyId})`,
            });

            // Find matching asset
            const asset = perf.trackSpanSync("find_matching_asset", () => {
                return (assets || []).find((a: HaloPSAAsset) => {
                    Debug.log({
                        module: "v1.0/ticket/create",
                        context: "POST",
                        message: `Evaluating HaloPSAAsset (HaloAssetID: ${a.id}) (HaloRMMID: ${a.datto_id})`,
                    });

                    if (body.rmm_id) {
                        return (
                            a.datto_id === body.rmm_id ||
                            a.inventory_number === agent.hostname
                        );
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

            const ticketInfo = {
                siteId: Number(site.psaCompanyId),
                clientId: Number(site.psaParentCompanyId),
                summary: body.summary,
                details: body.description || "",
                user: {
                    name: body.name,
                    email: body.email,
                    phone: body.phone,
                },
                impact: body.impact,
                urgency: body.urgency,
                assets: asset ? [asset.id] : [],
                images: body.link ? [body.link] : [],
            };

            // Create ticket in PSA
            const { data: createdTicketID } = await perf.trackSpan(
                "psa_create_ticket",
                async () => {
                    return await connector.createTicket(ticketInfo);
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

            // Log ticket usage for billing
            await perf.trackSpan("log_ticket_usage", async () => {
                try {
                    await client.mutation(api.ticket_usage.mutate_s.logTicketUsage, {
                        secret: CONVEX_API_KEY,
                        tenantId: agent.tenantId,
                        siteId: site._id,
                        agentId: agent._id,
                        ticketId: String(ticketID),
                        ticketSummary: body.summary,
                        psaType: psaIntegration.slug,
                        endpoint: "/v1.0/ticket/create",
                        metadata: {
                            impact: body.impact,
                            urgency: body.urgency,
                        },
                    });
                } catch (err) {
                    // Log error but don't fail the request
                    Debug.log({
                        module: "v1.0/ticket/create",
                        context: "log_ticket_usage",
                        message: `Failed to log ticket usage: ${err}`,
                    });
                }
            });

            // Log successful API call
            await logAgentApiCall(
                {
                    endpoint: "/v1.0/ticket/create",
                    method: "POST",
                    agentId: agent._id,
                    siteId: siteID,
                    tenantId: agent.tenantId,
                    psaSiteId: site.psaCompanyId,
                    rmmDeviceId: body.rmm_id,
                },
                {
                    statusCode: 200,
                    externalId: String(ticketID),
                    requestMetadata: {
                        ...ticketInfo,
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
                    const agent = (await client.query(api.helpers.orm.get_s, {
                        tableName: "agents",
                        id: deviceID as any,
                        secret: CONVEX_API_KEY,
                    })) as Doc<"agents">;

                    if (agent) {
                        await logAgentApiCall(
                            {
                                endpoint: "/v1.0/ticket/create",
                                method: "POST",
                                agentId: agent._id,
                                siteId: agent.siteId,
                                tenantId: agent.tenantId,
                            },
                            {
                                statusCode,
                                errorMessage,
                                requestMetadata: {},
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
                    },
                },
                500
            );
        }
    });
}
