import {
  BaseAdapter,
  RawDataProps,
} from "@workspace/pipeline/adapters/BaseAdapter";
import { DataFetchPayload } from "@workspace/shared/types/pipeline";
import SophosPartnerConnector from "@workspace/shared/lib/connectors/SophosPartnerConnector";
import {
  SophosPartnerConfig,
  SophosTenantConfig,
} from "@workspace/shared/types/integrations/sophos-partner";
import Debug from "@workspace/shared/lib/Debug";
import { getRow } from "@workspace/shared/lib/db/orm";
import Encryption from "@workspace/shared/lib/Encryption";
import { APIResponse } from "@workspace/shared/types/api";
import { Tables } from "@workspace/shared/types/database";

export class SophosPartnerAdapter extends BaseAdapter {
  constructor() {
    super("sophos-partner", ["endpoints"]);
  }

  protected async getRawData({
    eventData,
    tenantID,
    dataSource,
  }: RawDataProps) {
    if (!dataSource) {
      return Debug.error({
        module: "SophosPartnerAdapter",
        context: "getRawData",
        message: "SophosPartner does not support global syncs",
        code: "INVALID_SYNC",
      });
    }

    try {
      Debug.log({
        module: "SophosPartnerAdapter",
        context: "getRawData",
        message: `Fetching data for tenant ${tenantID}, dataSource ${dataSource.id || "N/A"}`,
      });

      switch (eventData.entityType) {
        case "endpoints": {
          return await this.handleEndpointSync(dataSource);
        }
      }

      return Debug.error({
        module: "SophosPartnerAdapter",
        context: "getRawData",
        message: `Entity type not supported: ${eventData.entityType}`,
        code: "SOPHOSPARTNER_FETCH_FAILED",
      });
    } catch (error) {
      return Debug.error({
        module: "SophosPartnerAdapter",
        context: "getRawData",
        message: `Failed to fetch data for tenant ${tenantID} stage ${eventData.stage}`,
        code: "SOPHOSPARTNER_FETCH_FAILED",
      });
    }
  }

  private async handleEndpointSync(
    dataSource: Tables<"data_sources">
  ): Promise<APIResponse<DataFetchPayload[]>> {
    const sophosSource = await getRow("data_sources", {
      filters: [
        ["integration_id", "eq", "sophos-partner"],
        ["site_id", "is", null],
      ],
    });
    if (sophosSource.error) {
      return Debug.error({
        module: "SophosPartnerAdapter",
        context: "handleEndpointSync",
        message: `Failed to fetch global data source`,
        code: "DB_FAILURE",
      });
    }
    const partnerConfig = sophosSource.data.config as SophosPartnerConfig;

    const connector = new SophosPartnerConnector(partnerConfig);
    const health = await connector.checkHealth();
    if (!health) {
      return Debug.error({
        module: "SophosPartnerAdapter",
        context: "handleEndpointSync",
        message: `Connector failed health check: ${dataSource.id}`,
        code: "CONNECTOR_FAILURE",
      });
    }

    const { data: endpoints, error } = await connector.getEndpoints(
      dataSource.config as SophosTenantConfig
    );
    if (error) {
      return { error };
    }

    return {
      data: endpoints.map((rawData) => {
        const dataHash = Encryption.sha256(
          JSON.stringify({
            ...rawData,
            lastSeenAt: undefined,
          })
        );
        return {
          externalID: rawData.id,

          dataHash,
          rawData,
          siteID: dataSource.site_id || undefined,
        };
      }),
    };
  }
}
