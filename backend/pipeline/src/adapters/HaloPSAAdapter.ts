import {
    BaseAdapter,
    RawDataProps,
    RawDataResult
} from "@workspace/pipeline/adapters/BaseAdapter.js";
import type { Doc } from "@workspace/database/convex/_generated/dataModel.js";
import Debug from "@workspace/shared/lib/Debug.js";
import Encryption from "@workspace/shared/lib/Encryption.js";
import { APIResponse } from "@workspace/shared/types/api.js";
import HaloPSAConnector from "@workspace/shared/lib/connectors/HaloPSAConnector.js";
import { HaloPSAConfig } from "@workspace/shared/types/integrations/halopsa/index.js";

export class HaloPSAAdapter extends BaseAdapter {
    constructor() {
        super("halopsa", ["companies"]);
    }

    protected async getRawData({
        eventData,
        dataSource,
        tenantID,
    }: RawDataProps) {
        if (!dataSource) {
            return Debug.error({
                module: "HaloPSAAdapter",
                context: "getRawData",
                message: `HaloPSA doesn't have any global sync methods. Missing data_source.`,
            });
        }

        Debug.log({
            module: "HaloPSAAdapter",
            context: "getRawData",
            message: `Fetching data for tenant ${tenantID}, dataSource ${dataSource._id || "N/A"}`,
        });

        switch (eventData.entityType) {
            case "companies": {
                return await this.handleCompanySync(dataSource);
            }
        }

        return Debug.error({
            module: "HaloPSAAdapter",
            context: "getRawData",
            message: `Stage not supported: ${eventData.stage}`,
        });
    }

    private async handleCompanySync(
        dataSource: Doc<"data_sources">
    ): Promise<APIResponse<RawDataResult>> {
        const connector = new HaloPSAConnector(
            dataSource.config as HaloPSAConfig,
            process.env.SECRET_KEY!
        );
        const health = await connector.checkHealth();
        if (!health) {
            return Debug.error({
                module: "HaloPSAAdapter",
                context: "handleCompanySync",
                message: `Connector failed health check: ${dataSource._id}`,
            });
        }

        const { data: companies, error } = await connector.getSites();
        if (error) {
            return { error };
        }

        return {
            data: {
                data: companies.map((rawData) => {
                    const dataHash = Encryption.sha256(
                        JSON.stringify({
                            ...rawData,
                            lastActivityDate: undefined,
                            lastTrackedModifiedDateTime: undefined,
                        })
                    );

                    return {
                        externalID: String(rawData.id),

                        dataHash,
                        rawData,
                    };
                }), hasMore: false
            }
        };
    }
}
