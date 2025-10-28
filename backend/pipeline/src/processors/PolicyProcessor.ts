import {
    BaseProcessor,
    PolicyData,
} from "@workspace/pipeline/processors/BaseProcessor.js";
import Debug from "@workspace/shared/lib/Debug.js";
import { MSGraphConditionalAccessPolicy } from "@workspace/shared/types/integrations/microsoft-365/policies.js";
import {
    IntegrationType,
    DataFetchPayload,
} from "@workspace/shared/types/pipeline/index.js";

export class PolicyProcessor extends BaseProcessor {
    constructor() {
        super("policies");
    }

    protected normalizeData(
        integrationType: IntegrationType,
        data: DataFetchPayload[]
    ): PolicyData[] {
        switch (integrationType) {
            case "microsoft-365":
                return this.fromMicrosoft365(data);
            default: {
                Debug.error({
                    module: "PolicyProcessor",
                    context: "normalizeData",
                    message: `No normalizer for this data: ${integrationType}`,
                });
                return [];
            }
        }
    }

    private fromMicrosoft365(data: DataFetchPayload[]) {
        return data.map((row) => {
            if (row.externalID === 'security-defaults') {
                return {
                    externalID: row.externalID,
                    raw: row.rawData,
                    hash: row.dataHash,
                    normalized: {
                        externalId: row.externalID,

                        name: 'Security Defaults',
                        createdAt: 0
                    }
                } as PolicyData
            }

            const { rawData, dataHash } = row as {
                rawData: MSGraphConditionalAccessPolicy;
                dataHash: string;
            };

            return {
                externalID: String(rawData.id),
                raw: rawData,
                hash: dataHash,
                normalized: {
                    externalId: rawData.id,

                    name: rawData.displayName,
                    createdAt: parseInt(rawData.createdDateTime)
                },
            } as PolicyData;
        });
    }
}
