import {
    BaseProcessor,
    RoleData,
} from "./BaseProcessor.js";
import Logger from "../lib/logger.js";
import { MSGraphRole } from "@workspace/shared/types/integrations/microsoft-365/roles.js";
import {
    IntegrationType,
    DataFetchPayload,
} from "@workspace/shared/types/pipeline/index.js";

export class RoleProcessor extends BaseProcessor {
    constructor() {
        super("roles");
    }

    protected normalizeData(
        integrationType: IntegrationType,
        data: DataFetchPayload[]
    ): RoleData[] {
        switch (integrationType) {
            case "microsoft-365":
                return this.fromMicrosoft365(data);
            default: {
                Logger.log({
                    module: "RoleProcessor",
                    context: "normalizeData",
                    message: `No normalizer for this data: ${integrationType}`,
                    level: "error",
                });
                return [];
            }
        }
    }

    private fromMicrosoft365(data: DataFetchPayload[]) {
        return data.map((row) => {
            const { rawData, dataHash } = row as {
                rawData: MSGraphRole;
                dataHash: string;
            };

            return {
                externalID: String(rawData.id),
                raw: rawData,
                hash: dataHash,
                normalized: {
                    externalId: rawData.id,

                    name: rawData.displayName,
                    description: rawData.description,
                    status: "enabled", // Active directory roles are always enabled
                },
            } as RoleData;
        });
    }
}
