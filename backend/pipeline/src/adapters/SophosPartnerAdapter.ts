import {
  BaseAdapter,
  RawDataProps,
} from "@workspace/pipeline/adapters/BaseAdapter.js";
import { api } from "@workspace/database/convex/_generated/api.js";
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
    super("sophos-partner", ["endpoints", "companies"]);
  }

  protected async getRawData({
    eventData,
    tenantID,
    dataSource,
  }: RawDataProps) {
    Debug.log({
      module: "SophosPartnerAdapter",
      context: "getRawData",
      message: `Fetching data for tenant ${tenantID}, dataSource ${dataSource._id || "N/A"}`,
    });

    if (dataSource.isPrimary) {
      switch (eventData.entityType) {
        case "companies": {
          return await this.handleCompanySync({
            eventData,
            tenantID,
            dataSource,
          });
        }
      }
    }

    switch (eventData.entityType) {
      case "endpoints": {
        return await this.handleEndpointSync({
          eventData,
          tenantID,
          dataSource,
        });
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
    props: RawDataProps
  ): Promise<APIResponse<DataFetchPayload[]>> {
    const sophosSource = await client.query(api.datasources.crud.get_s, {
      secret: process.env.CONVEX_API_KEY!,
      filters: {
        by_integration_primary: {
          integrationId: props.eventData.integrationID,
          isPrimary: true,
        },
      },
    });

    // Find the global data source (no siteId)
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
        message: `Connector failed health check: ${props.dataSource._id}`,
        code: "CONNECTOR_FAILURE",
      });
    }

    const { data: endpoints, error } = await connector.getEndpoints(
      props.dataSource.config as SophosTenantConfig
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
          siteID: props.dataSource.siteId,
        };
      }),
    };
  }

  private async handleCompanySync(
    props: RawDataProps
  ): Promise<APIResponse<DataFetchPayload[]>> {
    const partnerConfig = props.dataSource.config;

    const connector = new SophosPartnerConnector(
      partnerConfig,
      process.env.SECRET_KEY!
    );
    const health = await connector.checkHealth();
    if (!health) {
      return Debug.error({
        module: "SophosPartnerAdapter",
        context: "handleEndpointSync",
        message: `Connector failed health check: ${props.dataSource._id}`,
        code: "CONNECTOR_FAILURE",
      });
    }

    const { data: tenants, error } = await connector.getTenants();
    if (error) {
      return { error };
    }

    return {
      data: tenants.map((rawData) => {
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
        };
      }),
    };
  }
}
