import { NextRequest, NextResponse } from "next/server";
import { insertRows, updateRow, getRows } from "@/lib/supabase/orm";
import { TablesInsert } from "@workspace/shared/types/database";

interface CallbackState {
  action: "initial_consent" | "reconsent";
  siteId: string;
  integrationId: string;
  tenantId: string;
  timestamp: number;
}

interface TenantInfo {
  id: string;
  displayName: string;
  verifiedDomains: Array<{
    name: string;
    isDefault: boolean;
  }>;
  technicalNotificationMails: string[];
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const adminConsent = searchParams.get("admin_consent");
  const tenantId = searchParams.get("tenant");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  // Handle errors
  if (error) {
    console.error("Microsoft 365 consent error:", error, errorDescription);
    const errorMessage = errorDescription || error;
    return NextResponse.redirect(
      new URL(
        `/integrations/microsoft-365?error=${encodeURIComponent(errorMessage)}`,
        request.url
      )
    );
  }

  // Validate required parameters
  if (!adminConsent || !tenantId || !state) {
    return NextResponse.redirect(
      new URL(
        "/integrations/microsoft-365?error=Missing required parameters",
        request.url
      )
    );
  }

  // Check if admin consent was granted
  if (adminConsent !== "True") {
    return NextResponse.redirect(
      new URL(
        "/integrations/microsoft-365?error=Admin consent was denied",
        request.url
      )
    );
  }

  try {
    // Parse state to get site and integration info
    const stateData: CallbackState = JSON.parse(state);
    const { siteId, integrationId, tenantId: mspTenantId, action } = stateData;

    // Get access token using client credentials flow
    const tokenResponse = await fetch(
      `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: process.env.NEXT_PUBLIC_MICROSOFT_CLIENT_ID!,
          client_secret: process.env.NEXT_MICROSOFT_CLIENT_SECRET!,
          scope: "https://graph.microsoft.com/.default",
          grant_type: "client_credentials",
        }),
      }
    );

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      throw new Error(
        `Token request failed: ${errorData.error_description || errorData.error}`
      );
    }

    const tokenData = await tokenResponse.json();

    // Get tenant information using the access token
    const tenantInfoResponse = await fetch(
      "https://graph.microsoft.com/v1.0/organization",
      {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!tenantInfoResponse.ok) {
      throw new Error(
        `Failed to get tenant info: ${tenantInfoResponse.statusText}`
      );
    }

    const tenantInfoData = await tenantInfoResponse.json();
    const tenantInfo: TenantInfo = tenantInfoData.value[0];

    // Get the primary domain for display
    const primaryDomain =
      tenantInfo.verifiedDomains.find((d) => d.isDefault)?.name ||
      tenantInfo.verifiedDomains[0]?.name ||
      "Unknown Domain";

    // Get current integration to check consent number
    const integrationResult = await getRows("integrations", {
      filters: [["id", "eq", integrationId]],
    });

    if (!integrationResult.data?.rows?.[0]) {
      throw new Error("Integration not found");
    }

    const integration = integrationResult.data.rows[0];
    const currentRevision =
      (integration.config_schema as any)?.consent_version || 1;

    // Check if data source already exists for this site
    const existingDataSourceResult = await getRows("data_sources", {
      filters: [
        ["site_id", "eq", siteId],
        ["integration_id", "eq", integrationId],
      ],
    });

    const existingDataSource = existingDataSourceResult.data?.rows?.[0];

    if (action === "reconsent" && existingDataSource) {
      // Update existing data source with new consent info
      await updateRow("data_sources", {
        id: existingDataSource.id,
        row: {
          external_id: tenantId,
          config: {
            ...(existingDataSource.config as any),
            tenant_id: tenantInfo.id,
            tenant_name: tenantInfo.displayName,
            primary_domain: primaryDomain,
            consent_version: currentRevision,
            last_consent_at: new Date().toISOString(),
          },
          status: "connected",
          last_sync_at: null, // Reset sync status to trigger fresh sync
        },
      });

      console.log(
        `Updated Microsoft 365 consent for site ${siteId}, tenant ${tenantId}`
      );
    } else {
      // Create new data source
      const newDataSource: TablesInsert<"data_sources"> = {
        site_id: siteId,
        integration_id: integrationId,
        external_id: tenantId,
        tenant_id: mspTenantId,
        config: {
          tenant_id: tenantInfo.id,
          tenant_name: tenantInfo.displayName,
          primary_domain: primaryDomain,
          consent_version: currentRevision,
          last_consent_at: new Date().toISOString(),
        },
        status: "active",
        credential_expiration_at: "9999-12-31 23:59:59+00", // Client credentials don't expire like user tokens
      };

      const insertResult = await insertRows("data_sources", {
        rows: [newDataSource],
      });

      if (insertResult.error) {
        throw new Error(
          `Failed to create data source: ${insertResult.error.message}`
        );
      }

      console.log(
        `Created Microsoft 365 connection for site ${siteId}, tenant ${tenantId}`
      );
    }

    // Test the connection by making a simple API call
    const testResponse = await fetch(
      "https://graph.microsoft.com/v1.0/organization",
      {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
        },
      }
    );

    if (!testResponse.ok) {
      console.warn("Connection test failed:", testResponse.statusText);
    }

    // Redirect back to the integration page with success
    return NextResponse.redirect(
      new URL(
        `/integrations/microsoft-365?success=connected&tenant=${encodeURIComponent(tenantInfo.displayName)}`,
        request.url
      )
    );
  } catch (error: any) {
    console.error("Microsoft 365 callback processing error:", error);
    return NextResponse.redirect(
      new URL(
        `/integrations/microsoft-365?error=${encodeURIComponent(error.message)}`,
        request.url
      )
    );
  }
}
