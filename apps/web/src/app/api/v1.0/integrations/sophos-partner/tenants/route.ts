import { NextRequest, NextResponse } from "next/server";
import { getRow } from "@/lib/supabase/orm";
import SophosPartnerConnector from "@workspace/shared/lib/connectors/SophosPartnerConnector";
import { SophosPartnerConfig } from "@workspace/shared/types/integrations/sophos-partner";
import { APIResponse } from "@workspace/shared/types/api";
import Debug from "@workspace/shared/lib/Debug";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const integrationId = searchParams.get("integrationId");

    if (!integrationId) {
      const errorResponse: APIResponse<never> = {
        error: Debug.error({
          module: "SophosPartnerAPI",
          context: "getTenants",
          message: "Integration ID is required",
          code: "MISSING_INTEGRATION_ID",
        }).error!,
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    // Get the data source configuration
    const { data } = await getRow("data_sources", {
      filters: [
        ["integration_id", "eq", integrationId],
        ["site_id", "is", null],
      ],
    });

    if (!data) {
      const errorResponse: APIResponse<never> = {
        error: Debug.error({
          module: "SophosPartnerAPI",
          context: "getTenants",
          message: "No configuration found for integration",
          code: "CONFIG_NOT_FOUND",
        }).error!,
      };
      return NextResponse.json(errorResponse, { status: 404 });
    }

    // Use the connector to get tenants
    const connector = new SophosPartnerConnector(
      data.config as SophosPartnerConfig
    );
    const result = await connector.getTenants();

    if (result.error) {
      const errorResponse: APIResponse<never> = {
        error: result.error,
      };
      return NextResponse.json(errorResponse, { status: 500 });
    }

    const successResponse: APIResponse<typeof result.data> = {
      data: result.data,
    };

    return NextResponse.json(successResponse);
  } catch (error) {
    const errorResponse: APIResponse<never> = {
      error: Debug.error({
        module: "SophosPartnerAPI",
        context: "getTenants",
        message:
          error instanceof Error ? error.message : "Unknown error occurred",
        code: "INTERNAL_ERROR",
      }).error!,
    };

    return NextResponse.json(errorResponse, { status: 500 });
  }
}
