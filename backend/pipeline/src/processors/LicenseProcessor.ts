import {
    BaseProcessor,
    LicenseData,
} from "@workspace/pipeline/processors/BaseProcessor.js";
import Debug from "@workspace/shared/lib/Debug.js";
import {
    IntegrationType,
    DataFetchPayload,
} from "@workspace/shared/types/pipeline/index.js";

export class LicenseProcessor extends BaseProcessor {
    constructor() {
        super("licenses");
    }

    protected normalizeData(
        integrationType: IntegrationType,
        data: DataFetchPayload[]
    ): LicenseData[] {
        switch (integrationType) {
            case "microsoft-365":
                return this.fromMicrosoft365(data);
            default: {
                Debug.error({
                    module: "LicenseProcessor",
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
                rawData: any; // Microsoft Graph SubscribedSku type
                dataHash: string;
            };

            return {
                externalID: String(rawData.skuId),
                raw: rawData,
                hash: dataHash,
                normalized: {
                    externalId: rawData.skuId,

                    name: rawData.skuPartNumber,
                    skuPartNumber: rawData.skuPartNumber,
                    totalUnits: rawData.prepaidUnits?.enabled || 0,
                    consumedUnits: rawData.consumedUnits || 0,
                },
            } as LicenseData;
        });
    }
}
