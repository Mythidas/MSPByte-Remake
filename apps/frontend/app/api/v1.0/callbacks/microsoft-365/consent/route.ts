"use server";

import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import type {
  M365ConsentState,
  M365TokenResponse,
  M365TenantInfo,
} from "@workspace/shared/types/integrations/microsoft-365";
import type { Microsoft365DataSourceConfig } from "@workspace/shared/types/integrations/microsoft-365";
import type { Id } from "@workspace/database/convex/_generated/dataModel";
import { api } from "@/lib/api";

const client = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const redirectUrl = "/secure/default/integrations/microsoft-365/connections";

  const adminConsent = searchParams.get("admin_consent");
  const tenantId = searchParams.get("tenant");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  // Handle error from Microsoft
  if (error) {
    console.error("Microsoft 365 consent error:", error, errorDescription);
    return NextResponse.redirect(
      new URL(
        `${redirectUrl}?error=${encodeURIComponent("Failed to gain admin consent: " + (errorDescription || error))}`,
        request.url,
      ),
    );
  }

  // Validate required parameters
  if (!adminConsent || !tenantId || !state) {
    return NextResponse.redirect(
      new URL(
        `${redirectUrl}?error=${encodeURIComponent("Missing required parameters")}`,
        request.url,
      ),
    );
  }

  // Check if consent was granted
  if (adminConsent !== "True") {
    return NextResponse.redirect(
      new URL(
        `${redirectUrl}?error=${encodeURIComponent("Admin consent was denied")}`,
        request.url,
      ),
    );
  }

  try {
    // Parse state data
    const stateData: M365ConsentState = JSON.parse(state);

    // Wait for Microsoft to propagate permissions (same as Svelte implementation)
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Exchange consent for access token using client credentials
    const tokenResponse = await fetch(
      `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: process.env.MICROSOFT_CLIENT_ID!,
          client_secret: process.env.MICROSOFT_SECRET!,
          scope: "https://graph.microsoft.com/.default",
          grant_type: "client_credentials",
        }),
      },
    );

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      throw new Error(
        `Token request failed: ${errorData.error_description || errorData.error}`,
      );
    }

    const tokenData: M365TokenResponse = await tokenResponse.json();

    // Get tenant information using the access token
    const tenantInfoResponse = await fetch(
      "https://graph.microsoft.com/v1.0/organization",
      {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          "Content-Type": "application/json",
        },
      },
    );

    if (!tenantInfoResponse.ok) {
      throw new Error(
        `Failed to get tenant info: ${tenantInfoResponse.statusText}`,
      );
    }

    const tenantInfoData = await tenantInfoResponse.json();
    const tenantInfo: M365TenantInfo = tenantInfoData.value[0];

    // Get current permission version from integration config schema
    // Note: The Svelte code has a typo "permissionVerison" (missing 's'), keeping it for compatibility
    const currentRevision = 1;

    // Create the new M365 connection data source
    const dataSourceConfig: Microsoft365DataSourceConfig = {
      name: stateData.name,
      tenantId: tenantInfo.id,
      tenantName: tenantInfo.displayName,
      permissionVersion: currentRevision,
      domainMappings: [],
      availableDomains: tenantInfo.verifiedDomains.map((d) => ({
        name: d.name,
        isDefault: d.isDefault,
        userCount: 0,
      })),
    };

    // Insert the new connection data source
    await client.mutation(api.helpers.orm.insert_s, {
      tableName: "data_sources",
      secret: process.env.CONVEX_API_KEY!,
      tenantId: stateData.tenantId as Id<"tenants">,
      data: [
        {
          externalId: tenantId,
          status: "active" as const,
          integrationId: "microsoft-365",
          isPrimary: false,
          config: dataSourceConfig,
          credentialExpirationAt: Number.MAX_SAFE_INTEGER,
        },
      ],
    });

    // Update the primary data source to mark setup as initiated (permission version 0)
    // This matches the Svelte implementation behavior
    await client.mutation(api.helpers.orm.update_s, {
      tableName: "data_sources",
      secret: process.env.CONVEX_API_KEY!,
      data: [
        {
          id: stateData.dataSourceId as Id<"data_sources">,
          updates: { config: { permissionVersion: 0 } },
        },
      ],
    });

    // Redirect back with success
    return NextResponse.redirect(
      new URL(
        `${redirectUrl}?success=true&tenant=${encodeURIComponent(tenantInfo.displayName)}`,
        request.url,
      ),
    );
  } catch (error) {
    console.error("Microsoft 365 consent callback error:", error);
    return NextResponse.redirect(
      new URL(
        `${redirectUrl}?error=${encodeURIComponent(
          error instanceof Error ? error.message : "Unknown error occurred",
        )}`,
        request.url,
      ),
    );
  }
}
