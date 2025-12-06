import {
    BaseAdapter,
    RawDataProps,
    RawDataResult
} from "@workspace/pipeline/adapters/BaseAdapter.js";
import type { Doc } from "@workspace/database/convex/_generated/dataModel.js";
import Debug from "@workspace/shared/lib/Debug.js";
import Encryption from "@workspace/shared/lib/Encryption.js";
import { APIResponse } from "@workspace/shared/types/api.js";
import DattoRMMConnector from "@workspace/shared/lib/connectors/DattoRMMConnector.js";
import { DattoRMMConfig } from "@workspace/shared/types/integrations/dattormm/index.js";

export class DattoRMMAdapter extends BaseAdapter {
    constructor() {
        super("datto-rmm", ["companies"]);
    }

    protected async getRawData({
        eventData,
        dataSource,
        tenantID,
    }: RawDataProps) {
        if (!dataSource) {
            return Debug.error({
                module: "DattoRMMAdapter",
                context: "getRawData",
                message: `Datto RMM doesn't have any global sync methods. Missing data_source.`,
            });
        }

        Debug.log({
            module: "DattoRMMAdapter",
            context: "getRawData",
            message: `Fetching data for tenant ${tenantID}, dataSource ${dataSource._id || "N/A"}`,
        });

        switch (eventData.entityType) {
            case "companies": {
                return await this.handleSiteSync(dataSource);
            }
        }

        return Debug.error({
            module: "DattoRMMAdapter",
            context: "getRawData",
            message: `Entity type not supported: ${eventData.entityType}`,
        });
    }

    private async handleSiteSync(
        dataSource: Doc<"data_sources">
    ): Promise<APIResponse<RawDataResult>> {
        const connector = new DattoRMMConnector(
            dataSource.config as DattoRMMConfig,
            process.env.SECRET_KEY!
        );

        const health = await connector.checkHealth();
        if (health.error) {
            return Debug.error({
                module: "DattoRMMAdapter",
                context: "handleSiteSync",
                message: `Connector failed health check: ${dataSource._id} - ${health.error.message}`,
            });
        }

        const { data: sites, error } = await connector.getSites();
        if (error) {
            return { error };
        }


        return {
            data: {
                data: sites!.map((rawData) => {
                    // Hash the site data for change detection
                    // Exclude dynamic fields that don't represent meaningful changes
                    const dataHash = Encryption.sha256(
                        JSON.stringify({
                            uid: rawData.uid,
                            name: rawData.name,
                            description: rawData.description,
                            notes: rawData.notes,
                            onDemand: rawData.onDemand,
                            autotaskCompanyId: rawData.autotaskCompanyId,
                            connectwiseCompanyId: rawData.connectwiseCompanyId,
                            tigerpawAccountId: rawData.tigerpawAccountId,
                        })
                    );

                    return {
                        externalID: rawData.uid,
                        dataHash,
                        rawData,
                    };
                }),
                hasMore: false,
            }
        };
    }
}
