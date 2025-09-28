import { NextRequest, NextResponse } from "next/server";
import SophosPartnerConnector from "@workspace/shared/lib/connectors/SophosPartnerConnector";
import { SophosPartnerConfigInput } from "@/modules/integrations/sophos-partner/actions/config";
import { APIResponse } from "@workspace/shared/types/api";
import Debug from "@workspace/shared/lib/Debug";

// TODO: Move API routes to server actions
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const config = body as SophosPartnerConfigInput;

    if (!config?.client_id || !config?.client_secret) {
      const errorResponse: APIResponse<never> = {
        error: Debug.error({
          module: "SophosPartnerAPI",
          context: "testConnection",
          message: "Client ID and Client Secret are required",
          code: "MISSING_CREDENTIALS",
        }).error!,
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    // Test the connection
    const connector = new SophosPartnerConnector(config);
    const isHealthy = await connector.checkHealth();

    const successResponse: APIResponse<boolean> = {
      data: isHealthy.data || false,
    };

    return NextResponse.json(successResponse);
  } catch (error) {
    const errorResponse: APIResponse<never> = {
      error: Debug.error({
        module: "SophosPartnerAPI",
        context: "testConnection",
        message:
          error instanceof Error ? error.message : "Connection test failed",
        code: "CONNECTION_TEST_FAILED",
      }).error!,
    };

    return NextResponse.json(errorResponse, { status: 500 });
  }
}
