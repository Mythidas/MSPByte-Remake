import {
  BaseAdapter,
  RawDataProps,
} from "@workspace/pipeline/adapters/BaseAdapter";
import Debug from "@workspace/shared/lib/Debug";
import { APIResponse } from "@workspace/shared/types/api";
import AutoTaskConnector from "@workspace/shared/lib/connectors/AutoTaskConnector";
import { AutoTaskDataSourceConfig } from "@workspace/shared/types/integrations/autotask";
import Encryption from "@workspace/shared/lib/Encryption";
import { DataFetchPayload } from "@workspace/shared/types/pipeline";
import { Tables } from "@workspace/shared/types/database";

export class AutoTaskAdapter extends BaseAdapter {
  constructor() {
    super("autotask", ["companies"]);
  }

  protected async getRawData({
    eventData,
    dataSource,
    tenantID,
  }: RawDataProps) {
    if (!dataSource) {
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
        message: `Fetching data for tenant ${tenantID}, dataSource ${dataSource.id || "N/A"}`,
      });

      switch (eventData.entityType) {
        case "companies": {
          return await this.handleCompanySync(dataSource);
        }
      }

      return Debug.error({
        module: "AutoTaskAdapter",
        context: "getRawData",
        message: `Stage not supported: ${eventData.stage}`,
        code: "AUTOTASK_FETCH_FAILED",
      });
    } catch (error) {
      return Debug.error({
        module: "AutoTaskAdapter",
        context: "getRawData",
        message: `Failed to fetch data for tenant ${tenantID} stage ${eventData.stage}`,
        code: "AUTOTASK_FETCH_FAILED",
      });
    }
  }

  private async handleCompanySync(
    dataSource: Tables<"data_sources">
  ): Promise<APIResponse<DataFetchPayload[]>> {
    const connector = new AutoTaskConnector(
      dataSource.config as AutoTaskDataSourceConfig
    );
    const health = await connector.checkHealth();
    if (!health) {
      return Debug.error({
        module: "AutoTaskAdapter",
        context: "handleCompanySync",
        message: `Connector failed health check: ${dataSource.id}`,
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
