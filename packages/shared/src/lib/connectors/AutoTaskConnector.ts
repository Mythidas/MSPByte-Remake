import { IConnector } from "@workspace/shared/lib/connectors/index.js";
import Debug from "@workspace/shared/lib/Debug.js";
import Encryption from "@workspace/shared/lib/Encryption.js";
import { APIResponse } from "@workspace/shared/types/api.js";
import { AutoTaskCompany } from "@workspace/shared/types/integrations/autotask/company.js";
import {
  AutoTaskDataSourceConfig,
  AutoTaskSearch,
  AutoTaskResponse,
} from "@workspace/shared/types/integrations/autotask/index.js";

export class AutoTaskConnector implements IConnector {
  constructor(
    private config: AutoTaskDataSourceConfig,
    private encryptionKey: string
  ) {}

  async checkHealth() {
    return { data: true };
  }

  async getCompanies(): Promise<APIResponse<AutoTaskCompany[]>> {
    try {
      const search: AutoTaskSearch<AutoTaskCompany> = {
        filter: [{ field: "isActive", op: "eq", value: true }],
      };

      const secret =
        (await Encryption.decrypt(
          this.config.clientSecret,
          this.encryptionKey
        )) || "failed";

      const response = await fetch(
        `https://${this.config.server}/ATServicesRest/V1.0/Companies/query?search=${JSON.stringify(search)}`,
        {
          method: "GET",
          headers: {
            UserName: this.config.clientId,
            Secret: secret,
            ApiIntegrationCode: this.config.trackerId,
          },
        }
      );

      if (!response.ok) {
        return Debug.error({
          module: "AutoTaskConnector",
          context: "getCompanies",
          message: `HTTP ${response.status}: ${response.statusText}`,
          code: response.status,
        });
      }

      const data: AutoTaskResponse<AutoTaskCompany> = await response.json();

      return {
        data: data.items,
      };
    } catch (err) {
      return Debug.error({
        module: "AutoTaskConnector",
        context: "getCompanies",
        message: String(err),
        code: "AUTOTASK_API_FAILURE",
      });
    }
  }
}
