import { BaseProcessor, EndpointData } from "./BaseProcessor.js";
import Logger from "../lib/logger.js";
import { SophosPartnerEndpoint } from "@workspace/shared/types/integrations/sophos-partner/endpoints.js";
import {
  DataFetchPayload,
  IntegrationType,
} from "@workspace/shared/types/pipeline/index.js";

export class EndpointProcessor extends BaseProcessor {
  constructor() {
    super("endpoints");
  }

  protected normalizeData(
    integrationType: IntegrationType,
    data: DataFetchPayload[],
  ): EndpointData[] {
    switch (integrationType) {
      case "sophos-partner":
        return this.fromSophosPartner(data);
      default: {
        Logger.log({
          module: "EndpointProcessor",
          context: "normalizeData",
          message: `No normalizer for this data: ${integrationType}`,
          level: "error",
        });
        return [];
      }
    }
  }

  private fromSophosPartner(data: DataFetchPayload[]) {
    return data.map((row) => {
      const { rawData, dataHash, siteID } = row as {
        rawData: SophosPartnerEndpoint;
        dataHash: string;
        siteID?: string;
      };

      return {
        externalID: String(rawData.id),
        raw: rawData,
        hash: dataHash,
        siteID,
        normalized: {
          external_id: rawData.id,

          hostname: rawData.hostname,
          status: rawData.online ? "online" : "offline",
          os: rawData.os.name,

          ip_address: rawData.ipv4Addresses?.[0] || "",
          ext_address: "",
          mac_address: rawData.macAddresses?.[0] || "",

          last_check_in: rawData.lastSeenAt,
          protectionUpgradable:
            rawData.packages?.protection?.status === "upgradable" ||
            (rawData.packages?.protection?.available &&
              rawData.packages.protection.available.length > 0) ||
            false,
        },
      } as EndpointData;
    });
  }
}
