import APIClient from "@workspace/shared/lib/APIClient.js";
import { IConnector } from "@workspace/shared/lib/connectors/index.js";
import Encryption from "@workspace/shared/lib/Encryption.js";
import { APIResponse } from "@workspace/shared/types/api.js";
import { AutoTaskCompany } from "@workspace/shared/types/integrations/autotask/company.js";
import {
  AutoTaskDataSourceConfig,
  AutoTaskSearch,
  AutoTaskResponse,
} from "@workspace/shared/types/integrations/autotask/index.js";

export class AutoTaskConnector implements IConnector {
  constructor(private config: AutoTaskDataSourceConfig) {}

  async checkHealth() {
    return { data: true };
  }

  async getCompanies(): Promise<APIResponse<AutoTaskCompany[]>> {
    const search: AutoTaskSearch<AutoTaskCompany> = {
      filter: [{ field: "isActive", op: "eq", value: true }],
    };

    const secret =
      (await Encryption.decrypt(this.config.client_secret)) || "failed";
    const { data, error } = await APIClient.fetch<
      AutoTaskResponse<AutoTaskCompany>
    >(
      `https://${this.config.server}/ATServicesRest/V1.0/Companies/query?search=${JSON.stringify(search)}`,
      {
        method: "GET",
        headers: {
          UserName: this.config.client_id,
          Secret: secret,
          ApiIntegrationCode: this.config.tracker_id,
        },
      },
      "AutoTaskAdapter"
    );

    if (error) {
      return { error };
    }

    return {
      data: data.items,
    };
  }
}
