import {
  BaseAdapter,
  RawDataProps,
} from "@workspace/pipeline/adapters/BaseAdapter.js";
import type { Doc } from "@workspace/database/convex/_generated/dataModel.js";
import Debug from "@workspace/shared/lib/Debug.js";
import Encryption from "@workspace/shared/lib/Encryption.js";
import { APIResponse } from "@workspace/shared/types/api.js";
import { AutoTaskDataSourceConfig } from "@workspace/shared/types/integrations/autotask/index.js";
import { DataFetchPayload } from "@workspace/shared/types/pipeline/events.js";
import { AutoTaskConnector } from "@workspace/shared/lib/connectors/AutoTaskConnector.js";

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

    Debug.log({
      module: "AutoTaskAdapter",
      context: "getRawData",
      message: `Fetching data for tenant ${tenantID}, dataSource ${dataSource._id || "N/A"}`,
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
      code: "UNKNOWN_PIPELINE",
    });
  }

  private async handleCompanySync(
    dataSource: Doc<"data_sources">
  ): Promise<APIResponse<DataFetchPayload[]>> {
    const connector = new AutoTaskConnector(
      dataSource.config as AutoTaskDataSourceConfig,
      process.env.SECRET_KEY!
    );
    const health = await connector.checkHealth();
    if (!health) {
      return Debug.error({
        module: "AutoTaskAdapter",
        context: "handleCompanySync",
        message: `Connector failed health check: ${dataSource._id}`,
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
