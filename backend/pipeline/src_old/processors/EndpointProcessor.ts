import {
  BaseProcessor,
  EndpointData,
} from "@workspace/pipeline/processors/BaseProcessor.js";
import Debug from "@workspace/shared/lib/Debug.js";
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
    data: DataFetchPayload[]
  ): EndpointData[] {
    switch (integrationType) {
      case "sophos-partner":
        return this.fromSophosPartner(data);
      default: {
        Debug.error({
          module: "EndpointProcessor",
          context: "normalizeData",
          message: `No normalizer for this data: ${integrationType}`,
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
          protectionUpgradable: rawData.packages?.protection?.status === "upgradable" ||
                                (rawData.packages?.protection?.available && rawData.packages.protection.available.length > 0) ||
                                false,
        },
      } as EndpointData;
    });
  }
}
