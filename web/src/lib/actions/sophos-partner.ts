"use server";

import { insertRows, updateRow } from "@/lib/supabase/orm";
import SophosPartnerConnector from "@workspace/shared/lib/connectors/SophosPartnerConnector";
import Debug from "@workspace/shared/lib/Debug";
import Encryption from "@workspace/shared/lib/Encryption";
import { APIResponse } from "@workspace/shared/types/api";
import { SophosPartnerConfig } from "@workspace/shared/types/source/sophos-partner";

const sanitizeData = async (
  schema: Record<string, { label: string; sensitive?: boolean }>,
  data: Record<string, string>
) => {
  const entries = await Promise.all(
    Object.entries(data).map(async ([k, v]) => {
      const sensitive = schema[k]?.sensitive;
      const value = sensitive ? await Encryption.encrypt(v) : v;
      return [k, value] as const;
    })
  );

  return Object.fromEntries(entries);
};

export async function saveSophoPartnerConfig({
  tenantId,
  integrationId,
  dataSourceId,
  config,
  schema,
  data,
}: {
  tenantId: string;
  integrationId: string;
  dataSourceId?: string;
  config: SophosPartnerConfig;
  schema: Record<string, { label: string; sensitive?: boolean }>;
  data: Record<string, string>;
}): Promise<APIResponse<string>> {
  try {
    const connector = new SophosPartnerConnector(config);
    if (!(await connector.checkHealth())) {
      throw "Connect health check failed";
    }

    const sanitized = await sanitizeData(schema, data);

    if (!dataSourceId) {
      const result = await insertRows("data_sources", {
        rows: [
          {
            tenant_id: tenantId,
            integration_id: integrationId,
            config: { ...sanitized, expiration: undefined },
            credential_expiration_at: data["expiration"] as string,
          },
        ],
      });

      if (result.error) {
        throw `Insert Error: ${result.error.message}`;
      }

      return {
        data: "Created",
      };
    } else {
      const result = await updateRow("data_sources", {
        id: dataSourceId,
        row: {
          config: { ...sanitized, expiration: undefined },
          credential_expiration_at: data["expiration"] as string,
        },
      });

      if (result.error) {
        throw `Update Error: ${result.error.message}`;
      }

      return {
        data: "Updated",
      };
    }
  } catch (err) {
    return Debug.error({
      module: "SophosPartnerActions",
      context: "saveSophoPartnerConfig",
      message: String(err),
      code: "ACTION_FAILURE",
    });
  }
}

export async function getSophosPartnerTenants({
  config,
}: {
  config: SophosPartnerConfig;
}) {
  const connector = new SophosPartnerConnector(config);
  return await connector.getTenants();
}
