import {
    BaseProcessor,
    RoleData,
} from "@workspace/pipeline/processors/BaseProcessor.js";
import Debug from "@workspace/shared/lib/Debug.js";
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
                Debug.error({
                    module: "RoleProcessor",
                    context: "normalizeData",
                    message: `No normalizer for this data: ${integrationType}`,
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
