import {
  BaseAdapter,
  RawDataProps,
} from "@workspace/pipeline/adapters/BaseAdapter.js";
import { api } from "@workspace/database/convex/_generated/api.js";
import type { Doc } from "@workspace/database/convex/_generated/dataModel.js";
import Debug from "@workspace/shared/lib/Debug.js";
import Encryption from "@workspace/shared/lib/Encryption.js";
import { APIResponse } from "@workspace/shared/types/api.js";
import { DataFetchPayload } from "@workspace/shared/types/pipeline/events.js";
import SophosPartnerConnector from "@workspace/shared/lib/connectors/SophosPartnerConnector.js";
import {
  SophosPartnerConfig,
  SophosTenantConfig,
} from "@workspace/shared/types/integrations/sophos-partner/index.js";
import { client } from "@workspace/shared/lib/convex.js";

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

    Debug.log({
      module: "SophosPartnerAdapter",
      context: "getRawData",
      message: `Fetching data for tenant ${tenantID}, dataSource ${dataSource._id || "N/A"}`,
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
      code: "UNKNOWN_PIPELINE",
    });
  }

  private async handleEndpointSync(
    dataSource: Doc<"data_sources">
  ): Promise<APIResponse<DataFetchPayload[]>> {
    // Get the global Sophos Partner data source (tenant-level, no siteId)
    const sophosIntegration = await client.query(api.integrations.crud_s.get, {
      slug: "sophos-partner",
      secret: process.env.CONVEX_API_KEY!,
    });

    if (!sophosIntegration) {
      return Debug.error({
        module: "SophosPartnerAdapter",
        context: "handleEndpointSync",
        message: `Sophos Partner integration not found`,
        code: "DB_FAILURE",
      });
    }

    const sophosDataSources = await client.query(api.datasources.crud_s.list, {
      integrationId: sophosIntegration._id,
      tenantId: dataSource.tenantId,
      secret: process.env.CONVEX_API_KEY!,
    });

    // Find the global data source (no siteId)
    const sophosSource = sophosDataSources.find((ds) => !ds.siteId);
    if (!sophosSource) {
      return Debug.error({
        module: "SophosPartnerAdapter",
        context: "handleEndpointSync",
        message: `Failed to fetch global Sophos data source`,
        code: "DB_FAILURE",
      });
    }

    const partnerConfig = sophosSource.config as SophosPartnerConfig;

    const connector = new SophosPartnerConnector(
      partnerConfig,
      process.env.SECRET_KEY!
    );
    const health = await connector.checkHealth();
    if (!health) {
      return Debug.error({
        module: "SophosPartnerAdapter",
        context: "handleEndpointSync",
        message: `Connector failed health check: ${dataSource._id}`,
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
          siteID: dataSource.siteId || undefined,
        };
      }),
    };
  }
}
