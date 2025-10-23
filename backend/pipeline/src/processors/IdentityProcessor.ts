import {
  BaseProcessor,
  IdentityData,
} from "@workspace/pipeline/processors/BaseProcessor.js";
import Debug from "@workspace/shared/lib/Debug.js";
import { MSGraphIdentity } from "@workspace/shared/types/integrations/microsoft-365/identities.js";
import {
  DataFetchPayload,
  IntegrationType,
} from "@workspace/shared/types/pipeline/index.js";

export class IdentityProcessor extends BaseProcessor {
  constructor() {
    super("identities");
  }

  protected normalizeData(
    integrationType: IntegrationType,
    data: DataFetchPayload[]
  ): IdentityData[] {
    switch (integrationType) {
      case "microsoft-365":
        return this.fromMicrosoft365(data);
      default: {
        Debug.error({
          module: "IdentityProcessor",
          context: "normalizeData",
          message: `No normalizer for this data: ${integrationType}`,
        });
        return [];
      }
    }
  }

  private fromMicrosoft365(data: DataFetchPayload[]) {
    return data.map((row) => {
      const { rawData, dataHash, siteID } = row as {
        rawData: MSGraphIdentity;
        dataHash: string;
        siteID: string;
      };

      return {
        externalID: String(rawData.id),
        raw: rawData,
        hash: dataHash,
        siteID,
        normalized: {
          external_id: rawData.id,

          name: rawData.displayName,
          email: rawData.userPrincipalName,
          aliases:
            rawData.proxyAddresses
              ?.map((prox) => prox.substring(5))
              .filter(
                (prox) =>
                  prox.toLowerCase() !== rawData.userPrincipalName.toLowerCase()
              ) || [],
          type: rawData.userType?.toLowerCase() || "member",
          enabled: rawData.accountEnabled,

          licenses: rawData.assignedLicenses?.map((lic) => lic.skuId) || [],
          last_login_at:
            rawData.signInActivity?.lastSignInDateTime ||
            new Date(0).toISOString(),
        },
      } as IdentityData;
    });
  }
}
