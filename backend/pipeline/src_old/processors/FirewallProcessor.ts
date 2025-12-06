import {
  BaseProcessor,
  FirewallData,
} from "@workspace/pipeline/processors/BaseProcessor.js";
import Debug from "@workspace/shared/lib/Debug.js";
import { SophosPartnerFirewall } from "@workspace/shared/types/integrations/sophos-partner/firewall.js";
import {
  DataFetchPayload,
  IntegrationType,
} from "@workspace/shared/types/pipeline/index.js";

export class FirewallProcessor extends BaseProcessor {
  constructor() {
    super("firewalls");
  }

  protected normalizeData(
    integrationType: IntegrationType,
    data: DataFetchPayload[]
  ): FirewallData[] {
    switch (integrationType) {
      case "sophos-partner":
        return this.fromSophosPartner(data);
      default: {
        Debug.error({
          module: "FirewallProcessor",
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
        rawData: SophosPartnerFirewall;
        dataHash: string;
        siteID?: string;
      };

      return {
        externalID: String(rawData.id),
        raw: rawData,
        hash: dataHash,
        siteID,
        normalized: {
          externalId: rawData.id,
          serial: rawData.serialNumber,

          hostname: rawData.hostname,
          status: rawData.status.connected ? "online" : "offline",
          firmware: rawData.firmware?.firmwareVersion,
          firmwareUpgradeAvailable: rawData.firmware?.upgradeToVersion && rawData.firmware.upgradeToVersion.length > 0,
          model: rawData.model,

          extAddress: rawData.externalIpv4Addresses?.[0] || "",
          lastSeenAt: rawData.stateChangedAt,
        },
      } as FirewallData;
    });
  }
}
