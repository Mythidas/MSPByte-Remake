import {
    BaseAdapter,
    RawDataProps,
} from "@workspace/pipeline/adapters/BaseAdapter.js";
import type { Doc } from "@workspace/database/convex/_generated/dataModel.js";
import Debug from "@workspace/shared/lib/Debug.js";
import Encryption from "@workspace/shared/lib/Encryption.js";
import Microsoft365Connector from "@workspace/shared/lib/connectors/Microsoft365Connector.js";
import { APIResponse } from "@workspace/shared/types/api.js";
import { DataFetchPayload } from "@workspace/shared/types/pipeline/events.js";
import { Microsoft365DataSourceConfig } from "@workspace/shared/types/integrations/microsoft-365/index.js";

export class Microsoft365Adapter extends BaseAdapter {
    constructor() {
        super("microsoft-365", ["identities", "groups", "roles", "policies", "licenses"]);
    }

    protected async getRawData(
        props: RawDataProps
    ): Promise<APIResponse<DataFetchPayload[]>> {
        if (!props.dataSource) {
            return Debug.error({
                module: "Microsoft365Adapter",
                context: "getRawData",
                message: "Microsoft365 does not support global syncs",
            });
        }

        switch (props.eventData.entityType) {
            case "identities": {
                return await this.handleIdentitySync(props.dataSource);
            }
            case "groups": {
                return await this.handleGroupSync(props.dataSource);
            }
            case "roles": {
                return await this.handleRoleSync(props.dataSource);
            }
            case "policies": {
                return await this.handlePolicySync(props.dataSource);
            }
            case "licenses": {
                return await this.handleLicenseSync(props.dataSource);
            }
        }

        return Debug.error({
            module: "Microsoft365Adapter",
            context: "getRawData",
            message: `Entity type not supported: ${props.eventData.entityType}`,
        });
    }

    private async handleIdentitySync(dataSource: Doc<"data_sources">) {
        const config = dataSource.config as Microsoft365DataSourceConfig;


        if (!config?.domainMappings?.length) {
            return Debug.error({
                module: "Microsoft365Adapter",
                context: "getRawData",
                message: "Data source has no mapped domains or sites"
            })
        }

        const connector = new Microsoft365Connector(config);
        const health = await connector.checkHealth();
        if (!health) {
            return Debug.error({
                module: "Microsoft365Adapter",
                context: "handleIdentitySync",
                message: `Connector failed health check: ${dataSource._id}`,
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
                const siteID = config.domainMappings.find((map) =>
                    rawData.userPrincipalName.endsWith(map.domain)
                )?.siteId;

                return {
                    externalID: rawData.id,

                    dataHash,
                    rawData,
                    siteID,
                };
            }),
        };
    }

    private async handleGroupSync(dataSource: Doc<"data_sources">) {
        const config = dataSource.config as Microsoft365DataSourceConfig;

        const connector = new Microsoft365Connector(config);
        const health = await connector.checkHealth();
        if (!health) {
            return Debug.error({
                module: "Microsoft365Adapter",
                context: "handleIdentitySync",
                message: `Connector failed health check: ${dataSource._id}`,
            });
        }

        const { data: groups, error } = await connector.getGroups();
        if (error) {
            return { error };
        }
        return {
            data: groups.map((rawData) => {
                const dataHash = Encryption.sha256(
                    JSON.stringify({
                        ...rawData,
                        signInActivity: undefined,
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

    private async handlePolicySync(dataSource: Doc<"data_sources">) {
        const config = dataSource.config as Microsoft365DataSourceConfig;

        const connector = new Microsoft365Connector(config);
        const health = await connector.checkHealth();
        if (!health) {
            return Debug.error({
                module: "Microsoft365Adapter",
                context: "handleIdentitySync",
                message: `Connector failed health check: ${dataSource._id}`,
            });
        }

        const { data: policies, error } = await connector.getConditionalAccessPolicies();
        if (error) {
            return { error };
        }
        const { data: securityDefaults } = await connector.getSecurityDefaultsEnabled();

        return {
            data: [
                ...policies.map((rawData) => {
                    const dataHash = Encryption.sha256(
                        JSON.stringify({
                            ...rawData,
                            createdDateTime: undefined,
                            modifiedDataTime: undefined
                        })
                    );

                    return {
                        externalID: rawData.id,

                        dataHash,
                        rawData,
                    };
                }), { externalId: 'security-defaults', dataHash: Encryption.sha256(String(securityDefaults || false)), rawData: securityDefaults || false }] as DataFetchPayload[]
        };
    }

    private async handleRoleSync(dataSource: Doc<"data_sources">) {
        const config = dataSource.config as Microsoft365DataSourceConfig;

        const connector = new Microsoft365Connector(config);
        const health = await connector.checkHealth();
        if (!health) {
            return Debug.error({
                module: "Microsoft365Adapter",
                context: "handleIdentitySync",
                message: `Connector failed health check: ${dataSource._id}`,
            });
        }

        const { data: roles, error } = await connector.getRoles();
        if (error) {
            return { error };
        }

        return {
            data: roles.map((rawData) => {
                const dataHash = Encryption.sha256(
                    JSON.stringify({
                        ...rawData,
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

    private async handleLicenseSync(dataSource: Doc<"data_sources">) {
        const config = dataSource.config as Microsoft365DataSourceConfig;

        const connector = new Microsoft365Connector(config);
        const health = await connector.checkHealth();
        if (!health) {
            return Debug.error({
                module: "Microsoft365Adapter",
                context: "handleLicenseSync",
                message: `Connector failed health check: ${dataSource._id}`,
            });
        }

        const { data: skus, error } = await connector.getSubscribedSkus();
        if (error) {
            return { error };
        }

        return {
            data: skus.map((rawData) => {
                const dataHash = Encryption.sha256(
                    JSON.stringify({
                        ...rawData,
                    })
                );

                return {
                    externalID: rawData.skuId,

                    dataHash,
                    rawData,
                };
            }),
        };
    }
}
