import {
  BaseProcessor,
  CompanyData,
} from "@workspace/pipeline/processors/BaseProcessor.js";
import Debug from "@workspace/shared/lib/Debug.js";
import { AutoTaskCompany } from "@workspace/shared/types/integrations/autotask/company.js";
import { HaloPSASite } from "@workspace/shared/types/integrations/halopsa/sites.js";
import { SophosPartnerTenant } from "@workspace/shared/types/integrations/sophos-partner/tenants.js";
import { DattoRMMSite } from "@workspace/shared/types/integrations/dattormm/sites.js";
import {
  DataFetchPayload,
  IntegrationType,
} from "@workspace/shared/types/pipeline/index.js";

export class CompanyProcessor extends BaseProcessor {
  constructor() {
    super("companies");
  }

  protected normalizeData(
    integrationType: IntegrationType,
    data: DataFetchPayload[]
  ): CompanyData[] {
    switch (integrationType) {
      case "autotask":
        return this.fromAutoTask(data);
      case "halopsa":
        return this.fromHaloPSA(data);
      case "sophos-partner":
        return this.fromSophosPartner(data);
      case "datto-rmm":
        return this.fromDattoRMM(data);
      default: {
        Debug.error({
          module: "CompanyProcessor",
          context: "normalizeData",
          message: `No normalizer for this data: ${integrationType}`,
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

          created_at: rawData.createDate,
        },
      } as CompanyData;
    });
  }

  private fromHaloPSA(data: DataFetchPayload[]) {
    return data.map((row) => {
      const { rawData, dataHash } = row as {
        rawData: HaloPSASite;
        dataHash: string;
      };

      return {
        externalID: String(rawData.id),
        raw: rawData,
        hash: dataHash,
        normalized: {
          external_id: String(rawData.id),
          external_parent_id: String(rawData.client_id),

          name: rawData.name,
          parent_name: rawData.client_name,
          type: rawData.use,

          created_at: "",
        },
      } as CompanyData;
    });
  }

  private fromSophosPartner(data: DataFetchPayload[]) {
    return data.map((row) => {
      const { rawData, dataHash } = row as {
        rawData: SophosPartnerTenant;
        dataHash: string;
      };

      return {
        externalID: String(rawData.id),
        raw: rawData,
        hash: dataHash,
        normalized: {
          external_id: String(rawData.id),

          name: rawData.name,
          type: "customer",

          created_at: "",
        },
      } as CompanyData;
    });
  }

  private fromDattoRMM(data: DataFetchPayload[]) {
    return data.map((row) => {
      const { rawData, dataHash } = row as {
        rawData: DattoRMMSite;
        dataHash: string;
      };

      return {
        externalID: rawData.uid,
        raw: rawData,
        hash: dataHash,
        normalized: {
          external_id: rawData.uid,

          name: rawData.name,
          type: "customer",
          description: rawData.description,
          notes: rawData.notes,

          created_at: "",
        },
      } as CompanyData;
    });
  }
}
