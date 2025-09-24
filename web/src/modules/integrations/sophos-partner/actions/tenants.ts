"use server";

import SophosPartnerConnector from "@workspace/shared/lib/connectors/SophosPartnerConnector";
import { SophosPartnerConfig } from "@workspace/shared/types/integrations/sophos-partner";

export async function getSophosPartnerTenants(config: SophosPartnerConfig) {
  const connector = new SophosPartnerConnector(config);
  return await connector.getTenants();
}
