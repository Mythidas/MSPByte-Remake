import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server.js";
import { internal } from "./_generated/api.js";
import { Id } from "./_generated/dataModel.js";

const http = httpRouter();

/**
 * Validates the API secret from the request headers
 */
function validateApiSecret(request: Request): boolean {
  const apiSecret = request.headers.get("X-Convex-Secret");
  const expectedSecret = process.env.CONVEX_API_SECRET;

  if (!expectedSecret) {
    console.error("CONVEX_API_SECRET environment variable is not set");
    return false;
  }

  return apiSecret === expectedSecret;
}

/**
 * Agent GET endpoint - retrieves an agent by ID
 * POST /api/agents/get
 * Body: { id: string }
 * Headers: X-Convex-Secret
 */
http.route({
  path: "/api/agents/get",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    // Validate authentication
    if (!validateApiSecret(request)) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    try {
      const { id } = await request.json();

      if (!id) {
        return new Response(
          JSON.stringify({ error: "Missing id parameter" }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" }
          }
        );
      }

      const agent = await ctx.runQuery(internal.agents.query.get, {
        id: id as Id<"agents">,
      });

      return new Response(
        JSON.stringify(agent),
        {
          status: 200,
          headers: { "Content-Type": "application/json" }
        }
      );
    } catch (error) {
      console.error("Error in /api/agents/get:", error);
      return new Response(
        JSON.stringify({
          error: error instanceof Error ? error.message : "Internal server error"
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" }
        }
      );
    }
  }),
});

/**
 * Agent UPDATE endpoint - updates an agent's information
 * POST /api/agents/update
 * Body: { id, siteId?, guid?, hostname?, platform?, version?, ipAddress?, macAddress?, extAddress?, lastCheckinAt?, deletedAt? }
 * Headers: X-Convex-Secret
 */
http.route({
  path: "/api/agents/update",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    // Validate authentication
    if (!validateApiSecret(request)) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    try {
      const body = await request.json();
      const { id, ...rest } = body;

      if (!id) {
        return new Response(
          JSON.stringify({ error: "Missing id parameter" }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" }
          }
        );
      }

      const result = await ctx.runMutation(internal.agents.mutate.update, {
        id: id as Id<"agents">,
        ...rest,
      });

      return new Response(
        JSON.stringify({ success: result }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" }
        }
      );
    } catch (error) {
      console.error("Error in /api/agents/update:", error);
      return new Response(
        JSON.stringify({
          error: error instanceof Error ? error.message : "Internal server error"
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" }
        }
      );
    }
  }),
});

/**
 * Agent API LOG endpoint - creates an API log entry
 * POST /api/agents/log
 * Body: { tenantId, siteId, agentId, endpoint, method, statusCode, externalId?, psaSiteId?, rmmDeviceId?, reqMetadata, resMetadata, timeElapsedMs?, errorMessage? }
 * Headers: X-Convex-Secret
 */
http.route({
  path: "/api/agents/log",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    // Validate authentication
    if (!validateApiSecret(request)) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    try {
      const body = await request.json();

      // Validate required fields
      const requiredFields = ['tenantId', 'siteId', 'agentId', 'endpoint', 'method', 'statusCode', 'reqMetadata', 'resMetadata'];
      for (const field of requiredFields) {
        if (!(field in body)) {
          return new Response(
            JSON.stringify({ error: `Missing required field: ${field}` }),
            {
              status: 400,
              headers: { "Content-Type": "application/json" }
            }
          );
        }
      }

      await ctx.runMutation(internal.agents.mutate.createApiLog, {
        tenantId: body.tenantId as Id<"tenants">,
        siteId: body.siteId as Id<"sites">,
        agentId: body.agentId as Id<"agents">,
        endpoint: body.endpoint,
        method: body.method,
        statusCode: body.statusCode,
        externalId: body.externalId,
        psaSiteId: body.psaSiteId,
        rmmDeviceId: body.rmmDeviceId,
        reqMetadata: body.reqMetadata,
        resMetadata: body.resMetadata,
        timeElapsedMs: body.timeElapsedMs,
        errorMessage: body.errorMessage,
      });

      return new Response(
        JSON.stringify({ success: true }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" }
        }
      );
    } catch (error) {
      console.error("Error in /api/agents/log:", error);
      return new Response(
        JSON.stringify({
          error: error instanceof Error ? error.message : "Internal server error"
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" }
        }
      );
    }
  }),
});

export default http;
