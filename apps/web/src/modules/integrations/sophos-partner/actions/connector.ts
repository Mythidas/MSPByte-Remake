"use server";

import { getRow } from "@/lib/supabase/orm";
import SophosPartnerConnector from "@workspace/shared/lib/connectors/SophosPartnerConnector";
import {
  SophosPartnerConfig,
  SophosPartnerTenant,
} from "@workspace/shared/types/integrations/sophos-partner";
import { APIResponse } from "@workspace/shared/types/api";
import Debug from "@workspace/shared/lib/Debug";
import { SophosPartnerConfigInput } from "./config";

/**
 * Test connection to Sophos Partner API
 */
export async function testSophosPartnerConnection(
  config: SophosPartnerConfigInput
): Promise<APIResponse<boolean>> {
  try {
    if (!config?.client_id || !config?.client_secret) {
      return {
        error: Debug.error({
          module: "SophosPartnerActions",
          context: "testConnection",
          message: "Client ID and Client Secret are required",
          code: "MISSING_CREDENTIALS",
        }).error!,
      };
    }

    // Test the connection
    const connector = new SophosPartnerConnector(config);
    const healthCheck = await connector.checkHealth();

    if (healthCheck.error) {
      return { error: healthCheck.error };
    }

    return {
      data: healthCheck.data || false,
    };
  } catch (error) {
    console.error("[testSophosPartnerConnection] Error:", error);
    return {
      error: Debug.error({
        module: "SophosPartnerActions",
        context: "testConnection",
        message:
          error instanceof Error ? error.message : "Connection test failed",
        code: "CONNECTION_TEST_FAILED",
      }).error!,
    };
  }
}

/**
 * Get list of Sophos Partner tenants
 */
export async function getSophosPartnerTenants(
  integrationId: string
): Promise<APIResponse<SophosPartnerTenant[]>> {
  try {
    if (!integrationId) {
      return {
        error: Debug.error({
          module: "SophosPartnerActions",
          context: "getTenants",
          message: "Integration ID is required",
          code: "MISSING_INTEGRATION_ID",
        }).error!,
      };
    }

    // Get the data source configuration
    const { data, error: dbError } = await getRow("data_sources", {
      filters: [
        ["integration_id", "eq", integrationId],
        ["site_id", "is", null],
      ],
    });

    if (dbError || !data) {
      return {
        error: Debug.error({
          module: "SophosPartnerActions",
          context: "getTenants",
          message: "No configuration found for integration",
          code: "CONFIG_NOT_FOUND",
        }).error!,
      };
    }

    // Use the connector to get tenants
    const connector = new SophosPartnerConnector(
      data.config as SophosPartnerConfig
    );
    const result = await connector.getTenants();

    if (result.error) {
      return { error: result.error };
    }

    return {
      data: result.data || [],
    };
  } catch (error) {
    console.error("[getSophosPartnerTenants] Error:", error);
    return {
      error: Debug.error({
        module: "SophosPartnerActions",
        context: "getTenants",
        message:
          error instanceof Error ? error.message : "Failed to fetch tenants",
        code: "INTERNAL_ERROR",
      }).error!,
    };
  }
}
