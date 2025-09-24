"use server";

import { z } from "zod";
import { getRows, insertRows, updateRow } from "@/lib/supabase/orm";
import { SophosPartnerConfig } from "@workspace/shared/types/integrations/sophos-partner";
import SophosPartnerConnector from "@workspace/shared/lib/connectors/SophosPartnerConnector";
import Encryption from "@workspace/shared/lib/Encryption";

const sophosPartnerConfigSchema = z.object({
  client_id: z.string().min(1, "Client ID is required"),
  client_secret: z.string().min(1, "Client Secret is required"),
});

export type SophosPartnerConfigInput = z.infer<
  typeof sophosPartnerConfigSchema
>;

export async function saveSophosPartnerConfig(
  integrationId: string,
  config: SophosPartnerConfigInput
) {
  try {
    // Validate the input
    const validatedConfig = sophosPartnerConfigSchema.parse(config);

    // Encrypt the client secret
    const encryptedClientSecret = await Encryption.encrypt(
      validatedConfig.client_secret
    );

    // Create the config with encrypted secret
    const sophosPartnerConfig: SophosPartnerConfig = {
      client_id: validatedConfig.client_id,
      client_secret: encryptedClientSecret,
    };

    // Check if a data source already exists for this integration
    const existingResult = await getRows("data_sources", {
      filters: [["integration_id", "eq", integrationId]],
    });

    if (existingResult.data?.rows && existingResult.data.rows.length > 0) {
      // Update existing data source
      const existingDataSource = existingResult.data.rows[0];
      await updateRow("data_sources", {
        id: existingDataSource.id,
        row: {
          config: sophosPartnerConfig,
          status: "connected",
          updated_at: new Date().toISOString(),
        },
      });

      return { success: true, action: "updated" };
    } else {
      // Create new data source
      await insertRows("data_sources", {
        rows: [
          {
            integration_id: integrationId,
            config: sophosPartnerConfig,
            status: "connected",
            external_id: `sophos_partner_${validatedConfig.client_id}`,
            credential_expiration_at: new Date(
              Date.now() + 365 * 24 * 60 * 60 * 1000
            ).toISOString(), // 1 year from now
            tenant_id: integrationId, // Use integration_id as tenant_id for Sophos Partner
          },
        ],
      });

      return { success: true, action: "created" };
    }
  } catch (error) {
    console.error("Error saving Sophos Partner config:", error);

    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: "Validation failed",
        details: error.issues,
      };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}
