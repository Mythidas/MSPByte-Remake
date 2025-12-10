import { BaseProcessor, LicenseData } from "./BaseProcessor.js";
import Logger from "../lib/logger.js";
import {
  IntegrationType,
  DataFetchPayload,
} from "@workspace/shared/types/pipeline/index.js";
import { isBloatLicense } from "@workspace/shared/lib/licenses.js";

export class LicenseProcessor extends BaseProcessor {
  constructor() {
    super("licenses");
  }

  protected normalizeData(
    integrationType: IntegrationType,
    data: DataFetchPayload[],
  ): LicenseData[] {
    switch (integrationType) {
      case "microsoft-365":
        return this.fromMicrosoft365(data);
      case "sophos-partner":
        return this.fromSophosPartner(data);
      default: {
        Logger.log({
          module: "LicenseProcessor",
          context: "normalizeData",
          message: `No normalizer for this data: ${integrationType}`,
          level: "error",
        });
        return [];
      }
    }
  }

  private fromMicrosoft365(data: DataFetchPayload[]) {
    return data.map((row) => {
      const { rawData, dataHash, siteID, friendlyName } = row as {
        rawData: any; // Microsoft Graph SubscribedSku type
        dataHash: string;
        siteID?: string;
        friendlyName?: string;
      };

      const licenseName = friendlyName || rawData.skuPartNumber;
      const totalUnits = rawData.prepaidUnits?.enabled || 0;
      const consumedUnits = rawData.consumedUnits || 0;

      // Detect bloat licenses (free/trial/bulk)
      const tags: string[] = [];
      if (
        isBloatLicense({
          name: licenseName,
          skuPartNumber: rawData.skuPartNumber,
          totalUnits,
        })
      ) {
        tags.push("bloat");
      }

      return {
        externalID: String(rawData.skuId),
        raw: rawData,
        hash: dataHash,
        siteID,
        normalized: {
          externalId: rawData.skuId,
          name: licenseName,
          skuPartNumber: rawData.skuPartNumber,
          totalUnits,
          consumedUnits,
          tags: tags.length > 0 ? tags : undefined,
        },
      } as LicenseData;
    });
  }

  private fromSophosPartner(data: DataFetchPayload[]) {
    return data.flatMap((row) => {
      const { rawData, dataHash, siteID } = row as {
        rawData: any; // SophosPartnerFirewallLicense type
        dataHash: string;
        siteID?: string;
      };

      // Each license record contains multiple product licenses
      return (rawData.licenses || []).map((productLicense: any) => {
        return {
          externalID: productLicense.id,
          raw: { ...rawData, productLicense }, // Include parent context + specific license for UI access
          hash: dataHash,
          siteID,
          normalized: {
            externalId: productLicense.id,
            name:
              productLicense.product?.name ||
              productLicense.product?.code ||
              "Unknown License",
            totalUnits: productLicense.quantity,
            consumedUnits: productLicense.usage?.current?.count || 0,
          },
        } as LicenseData;
      });
    });
  }
}
