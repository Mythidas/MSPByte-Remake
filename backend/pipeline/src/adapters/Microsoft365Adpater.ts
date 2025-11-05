import {
    BaseAdapter,
    RawDataProps,
    RawDataResult,
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
    ): Promise<APIResponse<RawDataResult>> {
        if (!props.dataSource) {
            return Debug.error({
                module: "Microsoft365Adapter",
                context: "getRawData",
                message: "Microsoft365 does not support global syncs",
            });
        }

        switch (props.eventData.entityType) {
            case "identities": {
                return await this.handleIdentitySync(props.dataSource, props.cursor);
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

    private async handleIdentitySync(dataSource: Doc<"data_sources">, cursor?: string): Promise<APIResponse<RawDataResult>> {
        const config = dataSource.config as Microsoft365DataSourceConfig;

        if (!config?.domainMappings?.length) {
            return Debug.error({
                module: "Microsoft365Adapter",
                context: "handleIdentitySync",
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

        // Call connector with cursor support
        const { data, error } = await connector.getIdentities({
            domains: config.domainMappings.map((d) => d.domain),
            cursor
        });
        if (error) {
            return { error };
        }
        const { identities, next } = data;

        return {
            data: {
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
                nextCursor: next,
                hasMore: !!next,
            }
        };
    }

    private async handleGroupSync(dataSource: Doc<"data_sources">): Promise<APIResponse<RawDataResult>> {
        const config = dataSource.config as Microsoft365DataSourceConfig;

        const connector = new Microsoft365Connector(config);
        const health = await connector.checkHealth();
        if (!health) {
            return Debug.error({
                module: "Microsoft365Adapter",
                context: "handleGroupSync",
                message: `Connector failed health check: ${dataSource._id}`,
            });
        }

        const { data: groups, error } = await connector.getGroups();
        if (error) {
            return { error };
        }
        return {
            data: {
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
                hasMore: false,
            }
        };
    }

    private async handlePolicySync(dataSource: Doc<"data_sources">): Promise<APIResponse<RawDataResult>> {
        const config = dataSource.config as Microsoft365DataSourceConfig;

        const connector = new Microsoft365Connector(config);
        const health = await connector.checkHealth();
        if (!health) {
            return Debug.error({
                module: "Microsoft365Adapter",
                context: "handlePolicySync",
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
            data: {
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
                    }), sdPolicy
                ] as DataFetchPayload[],
                hasMore: false,
            }
        };
    }

    private async handleRoleSync(dataSource: Doc<"data_sources">): Promise<APIResponse<RawDataResult>> {
        const config = dataSource.config as Microsoft365DataSourceConfig;

        const connector = new Microsoft365Connector(config);
        const health = await connector.checkHealth();
        if (!health) {
            return Debug.error({
                module: "Microsoft365Adapter",
                context: "handleRoleSync",
                message: `Connector failed health check: ${dataSource._id}`,
            });
        }

        const { data: roles, error } = await connector.getRoles();
        if (error) {
            return { error };
        }

        return {
            data: {
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
                hasMore: false,
            }
        };
    }

    /**
     * Load license catalog from Microsoft's official CSV mapping file
     * Only loads once per adapter instance
     */
    private async loadLicenseCatalog(): Promise<void> {
        if (this.catalogLoaded) return;

        const csvUrl = "https://download.microsoft.com/download/e/3/e/e3e9faf2-f28b-490a-9ada-c6089a1fc5b0/Product%20names%20and%20service%20plan%20identifiers%20for%20licensing.csv";

        try {
            Debug.log({
                module: "Microsoft365Adapter",
                context: "loadLicenseCatalog",
                message: "Downloading Microsoft license catalog CSV...",
            });

            const response = await fetch(csvUrl);
            if (!response.ok) {
                throw new Error(`Failed to download CSV: ${response.statusText}`);
            }

            const csvText = await response.text();
            const lines = csvText.split('\n');

            // Skip header row
            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;

                // Parse CSV line (handle quoted fields)
                const fields = this.parseCSVLine(line);
                if (fields.length < 3) continue;

                const productDisplayName = fields[0]; // Product_Display_Name
                const stringId = fields[1]; // String_Id (skuPartNumber)
                const guid = fields[2]; // GUID (skuId)

                // Map both String_Id and GUID to the product display name
                if (stringId) {
                    this.licenseCatalog.set(stringId, productDisplayName);
                }
                if (guid) {
                    this.licenseCatalog.set(guid, productDisplayName);
                }
            }

            this.catalogLoaded = true;

            Debug.log({
                module: "Microsoft365Adapter",
                context: "loadLicenseCatalog",
                message: `Loaded ${this.licenseCatalog.size / 2} license SKUs from Microsoft CSV`,
            });
        } catch (err) {
            Debug.error({
                module: "Microsoft365Adapter",
                context: "loadLicenseCatalog",
                message: `Error loading license catalog: ${err}. Will use SKU IDs as fallback.`,
            });
            // Don't set catalogLoaded to true so it can retry on next sync
        }
    }

    /**
     * Parse a CSV line handling quoted fields with commas
     */
    private parseCSVLine(line: string): string[] {
        const fields: string[] = [];
        let currentField = '';
        let insideQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];

            if (char === '"') {
                insideQuotes = !insideQuotes;
            } else if (char === ',' && !insideQuotes) {
                fields.push(currentField.trim());
                currentField = '';
            } else {
                currentField += char;
            }
        }

        // Add the last field
        if (currentField) {
            fields.push(currentField.trim());
        }

        return fields;
    }

    private async handleLicenseSync(dataSource: Doc<"data_sources">): Promise<APIResponse<RawDataResult>> {
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

        // Load catalog from Microsoft's CSV on first license sync
        await this.loadLicenseCatalog();

        const { data: skus, error } = await connector.getSubscribedSkus();
        if (error) {
            return { error };
        }

        return {
            data: {
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
                hasMore: false,
            }
        };
    }
}
