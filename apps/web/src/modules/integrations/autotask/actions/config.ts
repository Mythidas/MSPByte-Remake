"use server";

import { z } from "zod";
import { getRows, insertRows, updateRow } from "@/lib/supabase/orm";
import { AutoTaskDataSourceConfig } from "@workspace/shared/types/integrations/autotask";
import { AutoTaskConnector } from "@workspace/shared/lib/connectors/AutoTaskConnector";
import Encryption from "@workspace/shared/lib/Encryption";

const autoTaskConfigSchema = z.object({
  server: z.string().min(1, "Server is required"),
  client_id: z.string().min(1, "Client ID is required"),
  tracker_id: z.string().min(1, "Tracker ID is required"),
  client_secret: z.string().min(1, "Client Secret is required"),
});

export type AutoTaskConfigInput = z.infer<typeof autoTaskConfigSchema>;

export async function saveAutoTaskConfig(
  integrationId: string,
  config: AutoTaskConfigInput
) {
  try {
    // Validate the input
    const validatedConfig = autoTaskConfigSchema.parse(config);

    // Encrypt the client secret
    const encryptedClientSecret = await Encryption.encrypt(
      validatedConfig.client_secret
    );

    // Create the config with encrypted secret
    const autoTaskConfig: AutoTaskDataSourceConfig = {
      server: validatedConfig.server,
      client_id: validatedConfig.client_id,
      tracker_id: validatedConfig.tracker_id,
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
          config: autoTaskConfig,
          status: "active",
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
            config: autoTaskConfig,
            status: "active",
            external_id: `autotask_${validatedConfig.server}`,
            credential_expiration_at: new Date(
              Date.now() + 365 * 24 * 60 * 60 * 1000
            ).toISOString(), // 1 year from now
            tenant_id: integrationId, // Use integration_id as tenant_id for AutoTask
          },
        ],
      });

      return { success: true, action: "created" };
    }
  } catch (error) {
    console.error("Error saving AutoTask config:", error);

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

export async function getAutoTaskConfig(integrationId: string) {
  try {
    const result = await getRows("data_sources", {
      filters: [["integration_id", "eq", integrationId]],
    });

    if (result.data?.rows && result.data.rows.length > 0) {
      const dataSource = result.data.rows[0];
      const config = dataSource.config as AutoTaskDataSourceConfig;

      // Decrypt the client secret for display (but don't return the actual value for security)
      return {
        success: true,
        config: {
          server: config.server,
          client_id: config.client_id,
          tracker_id: config.tracker_id,
          client_secret: "********", // Never return actual secret
        },
        hasConfig: true,
      };
    }

    return { success: true, hasConfig: false };
  } catch (error) {
    console.error("Error getting AutoTask config:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

export async function testAutoTaskConnection(config: AutoTaskConfigInput) {
  const connector = new AutoTaskConnector(config);
  return await connector.checkHealth();
}
