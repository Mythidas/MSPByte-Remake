import { AutoTaskConnector } from "@workspace/shared/lib/connectors/AutoTaskConnector.js";
import HaloPSAConnector from "@workspace/shared/lib/connectors/HaloPSAConnector.js";
import Microsoft365Connector from "@workspace/shared/lib/connectors/Microsoft365Connector.js";
import SophosPartnerConnector from "@workspace/shared/lib/connectors/SophosPartnerConnector.js";
import DattoRMMConnector from "@workspace/shared/lib/connectors/DattoRMMConnector.js";
import { APIResponse } from "@workspace/shared/types/api.js";
import { IntegrationType } from "@workspace/shared/types/pipeline/core.js";

export interface IConnector {
    checkHealth: () => Promise<APIResponse<boolean>>;
}

export function getConnector(
    integration: IntegrationType,
    config: any,
    secret: string
): IConnector | undefined {
    switch (integration) {
        case "autotask":
            return new AutoTaskConnector(config, secret);
        case "sophos-partner":
            return new SophosPartnerConnector(config, secret);
        case "microsoft-365":
            return new Microsoft365Connector(config);
        case "halopsa":
            return new HaloPSAConnector(config, secret);
        case "datto-rmm":
            return new DattoRMMConnector(config, secret);
        default: {
            console.error(
                `No connector defined for this integration: ${integration}`
            );
        }
    }
}
