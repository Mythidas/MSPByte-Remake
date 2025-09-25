import { BaseAdapter } from "@workspace/pipeline/adapters/BaseAdapter";
import Debug from "@workspace/shared/lib/Debug";
import { APIResponse } from "@workspace/shared/types/api";
import { Tables } from "@workspace/shared/types/database";
import { DataFetchPayload } from "@workspace/shared/types/events/data-event";
import AutoTaskConnector from "@workspace/shared/lib/connectors/AutoTaskConnector";
import { AutoTaskDataSourceConfig } from "@workspace/shared/types/integrations/autotask";
import Encryption from "@workspace/shared/lib/Encryption";
import { EventPayload } from "@workspace/shared/types/events";
import { Scheduler } from "@workspace/pipeline/scheduler";

export class AutoTaskAdapter extends BaseAdapter {
  constructor() {
    super("autotask");
  }

  protected async getRawData(
    eventData: EventPayload<"*.sync.*">,
    tenantID: string,
    dataSourceID?: string,
    config?: AutoTaskDataSourceConfig
  ) {
    if (!dataSourceID || !config) {
      return Debug.error({
        module: "AutoTaskAdapter",
        context: "getRawData",
        message: `AutoTask doesn't have any global sync methods. Missing data_source.`,
        code: "AUTOTASK_FETCH_FAILED",
      });
    }

    try {
      Debug.log({
        module: "AutoTaskAdapter",
        context: "getRawData",
        message: `Fetching data for tenant ${tenantID}, dataSource ${dataSourceID || "N/A"}`,
      });

      switch (eventData.type) {
        case "companies": {
          return await this.handleCompanySync(dataSourceID, config);
        }
      }

      return Debug.error({
        module: "AutoTaskAdapter",
        context: "getRawData",
        message: `Action not supported: sync.${eventData.type}`,
        code: "AUTOTASK_FETCH_FAILED",
      });
    } catch (error) {
      return Debug.error({
        module: "AutoTaskAdapter",
        context: "getRawData",
        message: `Failed to fetch data for tenant ${tenantID} action sync.${eventData.type}`,
        code: "AUTOTASK_FETCH_FAILED",
      });
    }
  }

  private async handleCompanySync(
    dataSourceID: string,
    config: AutoTaskDataSourceConfig
  ): Promise<APIResponse<DataFetchPayload[]>> {
    const connector = new AutoTaskConnector(config);
    const health = await connector.checkHealth();
    if (!health) {
      return Debug.error({
        module: "AutoTaskAdapter",
        context: "handleCompanySync",
        message: `Connector failed health check: ${dataSourceID}`,
        code: "CONNECTOR_FAILURE",
      });
    }

    const { data: companies, error } = await connector.getCompanies();
    if (error) {
      return { error };
    }

    return {
      data: companies.map((rawData) => {
        const dataHash = Encryption.sha256(
          JSON.stringify({
            ...rawData,
            lastActivityDate: undefined,
            lastTrackedModifiedDateTime: undefined,
          })
        );

        return {
          externalID: String(rawData.id),

          dataHash,
          rawData,
        };
      }),
    };
  }
}
