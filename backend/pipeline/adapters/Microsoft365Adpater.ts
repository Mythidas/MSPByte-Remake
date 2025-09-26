import {
  BaseAdapter,
  RawDataProps,
} from "@workspace/pipeline/adapters/BaseAdapter";
import Debug from "@workspace/shared/lib/Debug";
import { APIResponse } from "@workspace/shared/types/api";
import { Tables } from "@workspace/shared/types/database";
import { DataFetchPayload } from "@workspace/shared/types/pipeline";
import { Microsoft365DataSourceConfig } from "@workspace/shared/types/integrations/microsoft-365";
import Microsoft365Connector from "@workspace/shared/lib/connectors/Microsoft365Connector";
import Encryption from "@workspace/shared/lib/Encryption";

export class Microsoft365Adapter extends BaseAdapter {
  constructor() {
    super("microsoft-365", ["identities"]);
  }

  protected async getRawData(
    props: RawDataProps
  ): Promise<APIResponse<DataFetchPayload[]>> {
    if (!props.dataSource) {
      return Debug.error({
        module: "Microsoft365Adapter",
        context: "getRawData",
        message: "Microsoft365 does not support global syncs",
        code: "INVALID_SYNC",
      });
    }

    switch (props.eventData.entityType) {
      case "identities": {
        return await this.handleIdentitySync(props.dataSource);
      }
    }

    return Debug.error({
      module: "Microsoft365Adapter",
      context: "getRawData",
      message: `Entity type not supported: ${props.eventData.entityType}`,
      code: "UNKNOWN_PIPELINE",
    });
  }

  private async handleIdentitySync(dataSource: Tables<"data_sources">) {
    const config = dataSource.config as Microsoft365DataSourceConfig;

    const connector = new Microsoft365Connector(config);
    const health = await connector.checkHealth();
    if (!health) {
      return Debug.error({
        module: "Microsoft365Adapter",
        context: "handleIdentitySync",
        message: `Connector failed health check: ${dataSource.id}`,
        code: "CONNECTOR_FAILURE",
      });
    }

    const { data, error } = await connector.getIdentities({});
    if (error) {
      return { error };
    }
    const { identities } = data;

    return {
      data: identities.map((rawData) => {
        const dataHash = Encryption.sha256(
          JSON.stringify({
            ...rawData,
            signInActivity: undefined,
          })
        );
        const siteID = config.domain_mappings.find((map) =>
          rawData.userPrincipalName.endsWith(map.domain)
        )?.site_id;

        return {
          externalID: rawData.id,

          dataHash,
          rawData,
          siteID,
        };
      }),
    };
  }
}
