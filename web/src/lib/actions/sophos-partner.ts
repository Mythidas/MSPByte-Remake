"use server";

import { saveDataSourceConfig } from "@/lib/actions/data-source";
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
  config,
  ...props
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
      throw "Connector health check failed";
    }

    return await saveDataSourceConfig(props);
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
