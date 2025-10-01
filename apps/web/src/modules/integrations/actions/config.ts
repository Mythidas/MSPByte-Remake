"use server";

import { getRow, upsertRows } from "@/lib/supabase/orm";
import SophosPartnerConnector from "@workspace/shared/lib/connectors/SophosPartnerConnector";
import { HaloPSAConnector } from "@workspace/shared/lib/connectors/HaloPSAConnector";
import Debug from "@workspace/shared/lib/Debug";
import Encryption from "@workspace/shared/lib/Encryption";
import { APIResponse } from "@workspace/shared/types/api";
import { SophosPartnerConfig } from "@workspace/shared/types/integrations/sophos-partner";
import { HaloPSAConfig } from "@workspace/shared/types/integrations/halopsa";
import { generateUUID } from "@workspace/shared/lib/utils.server";

type SaveConfigProps = {
  data: Record<string, string>;
  integrationID: string;
  tenantID: string;
  expires?: string;
};

export async function saveConfig({
  data,
  integrationID,
  tenantID,
  expires,
}: SaveConfigProps) {
  const test = await testConfig({ data, integrationID });
  if (!test.data) {
    return Debug.error({
      module: "ConfigActions",
      context: "saveConfig",
      message: test.error?.message || "Failed config testing",
      code: "FAILED_TEST",
    });
  }

  const config = await cleanConfig(data);
  return await upsertRows("data_sources", {
    rows: [
      {
        tenant_id: tenantID,
        integration_id: integrationID,
        site_id: await generateUUID(true),
        config: config as any,
        credential_expiration_at: expires || "9999-12-31 23:59:59+00",
      },
    ],
    onConflict: ["tenant_id", "integration_id", "site_id"],
  });
}

export async function testConfig({
  data,
  integrationID,
}: Omit<SaveConfigProps, "tenantID" | "expires">): Promise<
  APIResponse<boolean>
> {
  try {
    switch (integrationID) {
      case "sophos-partner": {
        const connector = new SophosPartnerConnector(
          data as SophosPartnerConfig
        );
        return await connector.checkHealth();
      }
      case "halopsa": {
        if (!data.client_secret) {
          const existing = await getRow("data_sources", {
            filters: [
              ["integration_id", "eq", integrationID],
              ["site_id", "eq", generateUUID(true)],
            ],
          });

          if (existing.data?.config) {
            data.client_secret =
              (await Encryption.decrypt(
                (existing.data.config as HaloPSAConfig).client_secret
              )) || "";
          }
        }

        const connector = new HaloPSAConnector(data as HaloPSAConfig);
        return await connector.checkHealth();
      }
      default:
        throw `No test defined for ${integrationID}`;
    }
  } catch (err) {
    return Debug.error({
      module: "ConfigActions",
      context: "testConfig",
      message: `Failed to test: ${err}`,
      code: "INVALID_TEST_CONFIG",
    });
  }
}

async function cleanConfig(data: Record<string, string>) {
  const KEY_WORDS = ["secret"];

  for (const [key, val] of Object.entries(data)) {
    const sensitive = KEY_WORDS.some((word) =>
      key.toLowerCase().includes(word)
    );
    if (sensitive) {
      data[key] = await Encryption.encrypt(val);
    }
  }

  return data;
}
