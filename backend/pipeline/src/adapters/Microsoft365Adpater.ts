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
    private licenseCatalog: Map<string, string> = new Map();
    private catalogLoaded = false;

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
        const sdPolicy = {
            externalID: 'security-defaults',
            dataHash: Encryption.sha256(String(securityDefaults || false)),
            rawData: securityDefaults
        }

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
                }), sdPolicy] as DataFetchPayload[]
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

    /**
     * Load license catalog into memory for friendly name lookups
     * Only loads once per adapter instance
     */
    private async loadLicenseCatalog(connector: Microsoft365Connector): Promise<void> {
        if (this.catalogLoaded) return;

        try {
            const { data: skus, error } = await connector.getSubscribedSkus();
            if (error) {
                Debug.error({
                    module: "Microsoft365Adapter",
                    context: "loadLicenseCatalog",
                    message: `Failed to load license catalog: ${error.message}`,
                });
                return;
            }

            // Build catalog: SKU part number → Friendly name
            skus.forEach((sku) => {
                // Use the first service plan name as the friendly name
                // Fall back to skuPartNumber if no service plans
                const friendlyName = sku.servicePlans?.[0]?.servicePlanName || sku.skuPartNumber;

                // Map both skuPartNumber and skuId for lookups
                this.licenseCatalog.set(sku.skuPartNumber, friendlyName);
                this.licenseCatalog.set(sku.skuId, friendlyName);
            });

            this.catalogLoaded = true;

            Debug.log({
                module: "Microsoft365Adapter",
                context: "loadLicenseCatalog",
                message: `Loaded ${this.licenseCatalog.size / 2} license SKUs into memory`, // Divide by 2 since we store each twice
            });
        } catch (err) {
            Debug.error({
                module: "Microsoft365Adapter",
                context: "loadLicenseCatalog",
                message: `Error loading license catalog: ${err}`,
            });
        }
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

        // Load catalog on first license sync
        await this.loadLicenseCatalog(connector);

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

                // Get friendly name from catalog, fallback to skuPartNumber
                const friendlyName = this.licenseCatalog.get(rawData.skuPartNumber)
                    || this.licenseCatalog.get(rawData.skuId)
                    || rawData.skuPartNumber;

                return {
                    externalID: rawData.skuId,
                    dataHash,
                    rawData,
                    friendlyName, // Add friendly name to payload
                };
            }),
        };
    }
}
