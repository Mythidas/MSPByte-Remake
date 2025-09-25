import {
  BaseProcessor,
  CompanyData,
} from "@workspace/pipeline/processors/BaseProcessor";
import Debug from "@workspace/shared/lib/Debug";
import { AutoTaskCompany } from "@workspace/shared/types/integrations/autotask/company";
import { DataFetchPayload } from "@workspace/shared/types/pipeline";

export class CompanyProcessor extends BaseProcessor {
  constructor() {
    super("companies");
  }

  protected normalizeData(
    integrationID: string,
    data: DataFetchPayload[]
  ): CompanyData[] {
    switch (integrationID) {
      case "autotask":
        return this.fromAutoTask(data);
      default: {
        Debug.error({
          module: "CompanyProcessor",
          context: "normalizeData",
          message: `No normalizer for this data: ${integrationID} | companies`,
          code: "NORMALIZER_NOT_FOUND",
        });
        return [];
      }
    }
  }

  private fromAutoTask(data: DataFetchPayload[]) {
    return data.map((row) => {
      const { rawData, dataHash } = row as {
        rawData: AutoTaskCompany;
        dataHash: string;
      };

      return {
        externalID: String(rawData.id),
        raw: rawData,
        hash: dataHash,
        normalized: {
          external_id: String(rawData.id),
          external_parent_id: String(rawData.parentCompanyID),

          name: rawData.companyName,
          type: rawData.companyType === 1 ? "customer" : "prospect",
          address: rawData.address1,

          created_at: rawData.createDate,
        },
      } as CompanyData;
    });
  }
}
