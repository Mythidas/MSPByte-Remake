import { AutoTaskConnector } from "@workspace/shared/lib/connectors/AutoTaskConnector.js";
import Microsoft365Connector from "@workspace/shared/lib/connectors/Microsoft365Connector.js";
import SophosPartnerConnector from "@workspace/shared/lib/connectors/SophosPartnerConnector.js";
import { APIResponse } from "@workspace/shared/types/api.js";
import { IntegrationType } from "@workspace/shared/types/pipeline/core.js";

export interface IConnector {
  checkHealth: () => Promise<APIResponse<boolean>>;
}

export function getConnector(
  integration: IntegrationType,
  config: any
): IConnector | undefined {
  switch (integration) {
    case "autotask":
      return new AutoTaskConnector(config);
    case "sophos-partner":
      return new SophosPartnerConnector(config);
    case "microsoft-365":
      return new Microsoft365Connector(config);
    default: {
      console.error(
        `No connector defined for this integration: ${integration}`
      );
    }
  }
}
