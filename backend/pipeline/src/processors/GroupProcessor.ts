import {
  BaseProcessor,
  GroupData,
} from "@workspace/pipeline/processors/BaseProcessor.js";
import Debug from "@workspace/shared/lib/Debug.js";
import { MSGraphGroup } from "@workspace/shared/types/integrations/microsoft-365/groups.js";
import {
  IntegrationType,
  DataFetchPayload,
} from "@workspace/shared/types/pipeline/index.js";

export class GroupProcessor extends BaseProcessor {
  constructor() {
    super("groups");
  }

  protected normalizeData(
    integrationType: IntegrationType,
    data: DataFetchPayload[]
  ): GroupData[] {
    switch (integrationType) {
      case "microsoft-365":
        return this.fromMicrosoft365(data);
      default: {
        Debug.error({
          module: "GroupProcessor",
          context: "normalizeData",
          message: `No normalizer for this data: ${integrationType}`,
          code: "NORMALIZER_NOT_FOUND",
        });
        return [];
      }
    }
  }

  private fromMicrosoft365(data: DataFetchPayload[]) {
    const groupType = (row: MSGraphGroup) => {
      if (
        row.groupTypes.includes("Unified") &&
        row.mailEnabled &&
        !row.securityEnabled
      ) {
        return "modern";
      } else if (row.mailEnabled) {
        return "distribution";
      } else if (row.securityEnabled) {
        return "security";
      }

      return "custom";
    };

    return data.map((row) => {
      const { rawData, dataHash } = row as {
        rawData: MSGraphGroup;
        dataHash: string;
      };

      return {
        externalID: String(rawData.id),
        raw: rawData,
        hash: dataHash,
        normalized: {
          external_id: rawData.id,

          name: rawData.displayName,
          type: groupType(rawData),
          description: rawData.description,

          created_at: rawData.createdDateTime,
        },
      } as GroupData;
    });
  }
}
