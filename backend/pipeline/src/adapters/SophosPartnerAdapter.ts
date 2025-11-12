import {
    BaseAdapter,
    RawDataProps,
    RawDataResult
} from "@workspace/pipeline/adapters/BaseAdapter.js";
import { api } from "@workspace/database/convex/_generated/api.js";
import Debug from "@workspace/shared/lib/Debug.js";
import Encryption from "@workspace/shared/lib/Encryption.js";
import { APIResponse } from "@workspace/shared/types/api.js";
import { DataFetchPayload } from "@workspace/shared/types/pipeline/events.js";
import SophosPartnerConnector from "@workspace/shared/lib/connectors/SophosPartnerConnector.js";
import {
    SophosPartnerConfig,
    SophosTenantConfig,
} from "@workspace/shared/types/integrations/sophos-partner/index.js";
import { client } from "@workspace/shared/lib/convex.js";
import { Doc } from "@workspace/database/convex/_generated/dataModel.js";

export class SophosPartnerAdapter extends BaseAdapter {
    constructor() {
        super("sophos-partner", ["endpoints", "companies", "firewalls", "licenses"]);
    }

    protected async getRawData({
        eventData,
        tenantID,
        dataSource,
        ...rest
    }: RawDataProps) {
        Debug.log({
            module: "SophosPartnerAdapter",
            context: "getRawData",
            message: `Fetching data for tenant ${tenantID}, dataSource ${dataSource._id || "N/A"}`,
        });

        if (dataSource.isPrimary) {
            switch (eventData.entityType) {
                case "companies": {
                    return await this.handleCompanySync({
                        eventData,
                        tenantID,
                        dataSource,
                        ...rest
                    });
                }
            }
        }

        switch (eventData.entityType) {
            case "endpoints": {
                return await this.handleEndpointSync({
                    eventData,
                    tenantID,
                    dataSource,
                    ...rest
                });
            }
            case "firewalls": {
                return await this.handleFirewallSync({
                    eventData,
                    tenantID,
                    dataSource, ...rest
                });
            }
            case "licenses": {
                return await this.handleLicenseSync({
                    eventData,
                    tenantID,
                    dataSource,
                    ...rest
                });
            }
        }

        return Debug.error({
            module: "SophosPartnerAdapter",
            context: "getRawData",
            message: `Entity type not supported: ${eventData.entityType}`,
        });
    }

    private async handleEndpointSync(
        props: RawDataProps
    ): Promise<APIResponse<RawDataResult>> {
        const sophosSource = (await client.query(api.helpers.orm.get_s, {
            tableName: "data_sources",
            secret: process.env.CONVEX_API_KEY!,
            index: {
                name: "by_integration_primary",
                params: {
                    integrationId: props.eventData.integrationID,
                    isPrimary: true,
                },
            },
        })) as Doc<"data_sources">;

        // Find the global data source (no siteId)
        if (!sophosSource) {
            return Debug.error({
                module: "SophosPartnerAdapter",
                context: "handleEndpointSync",
                message: `Failed to fetch global Sophos data source`,
            });
        }

        const partnerConfig = sophosSource.config as SophosPartnerConfig;

        const connector = new SophosPartnerConnector(
            partnerConfig,
            process.env.SECRET_KEY!
        );
        const health = await connector.checkHealth();
        if (!health) {
            return Debug.error({
                module: "SophosPartnerAdapter",
                context: "handleEndpointSync",
                message: `Connector failed health check: ${props.dataSource._id}`,
            });
        }

        const { data: endpoints, error } = await connector.getEndpoints(
            props.dataSource.config as SophosTenantConfig
        );
        if (error) {
            return { error };
        }

        return {
            data: {
                data: endpoints.map((rawData) => {
                    const dataHash = Encryption.sha256(
                        JSON.stringify({
                            ...rawData,
                            lastSeenAt: undefined,
                        })
                    );
                    return {
                        externalID: rawData.id,

                        dataHash,
                        rawData,
                        siteID: props.dataSource.siteId,
                    };
                }), hasMore: false
            }
        };
    }

    private async handleFirewallSync(
        props: RawDataProps
    ): Promise<APIResponse<RawDataResult>> {
        const sophosSource = (await client.query(api.helpers.orm.get_s, {
            tableName: "data_sources",
            secret: process.env.CONVEX_API_KEY!,
            index: {
                name: "by_integration_primary",
                params: {
                    integrationId: props.eventData.integrationID,
                    isPrimary: true,
                },
            },
        })) as Doc<"data_sources">;

        // Find the global data source (no siteId)
        if (!sophosSource) {
            return Debug.error({
                module: "SophosPartnerAdapter",
                context: "handleEndpointSync",
                message: `Failed to fetch global Sophos data source`,
            });
        }

        const partnerConfig = sophosSource.config as SophosPartnerConfig;

        const connector = new SophosPartnerConnector(
            partnerConfig,
            process.env.SECRET_KEY!
        );
        const health = await connector.checkHealth();
        if (!health) {
            return Debug.error({
                module: "SophosPartnerAdapter",
                context: "handleEndpointSync",
                message: `Connector failed health check: ${props.dataSource._id}`,
            });
        }

        const { data: endpoints, error } = await connector.getFirewalls(
            props.dataSource.config as SophosTenantConfig
        );
        if (error) {
            return { error };
        }

        return {
            data: {
                data: endpoints.map((rawData) => {
                    const dataHash = Encryption.sha256(
                        JSON.stringify({
                            ...rawData,
                            lastSeenAt: undefined,
                        })
                    );
                    return {
                        externalID: rawData.id,

                        dataHash,
                        rawData,
                        siteID: props.dataSource.siteId,
                    };
                }), hasMore: false
            }
        };
    }

    private async handleCompanySync(
        props: RawDataProps
    ): Promise<APIResponse<RawDataResult>> {
        const partnerConfig = props.dataSource.config;

        const connector = new SophosPartnerConnector(
            partnerConfig,
            process.env.SECRET_KEY!
        );
        const health = await connector.checkHealth();
        if (!health) {
            return Debug.error({
                module: "SophosPartnerAdapter",
                context: "handleEndpointSync",
                message: `Connector failed health check: ${props.dataSource._id}`,
            });
        }

        const { data: tenants, error } = await connector.getTenants();
        if (error) {
            return { error };
        }

        return {
            data: {
                data: tenants.map((rawData) => {
                    const dataHash = Encryption.sha256(
                        JSON.stringify({
                            ...rawData,
                            lastSeenAt: undefined,
                        })
                    );
                    return {
                        externalID: rawData.id,

                        dataHash,
                        rawData,
                    };
                }), hasMore: false
            }
        };
    }

    private async handleLicenseSync(
        props: RawDataProps
    ): Promise<APIResponse<RawDataResult>> {
        const sophosSource = (await client.query(api.helpers.orm.get_s, {
            tableName: "data_sources",
            secret: process.env.CONVEX_API_KEY!,
            index: {
                name: "by_integration_primary",
                params: {
                    integrationId: props.eventData.integrationID,
                    isPrimary: true,
                },
            },
        })) as Doc<"data_sources">;

        // Find the global data source (no siteId)
        if (!sophosSource) {
            return Debug.error({
                module: "SophosPartnerAdapter",
                context: "handleLicenseSync",
                message: `Failed to fetch global Sophos data source`,
            });
        }

        const partnerConfig = sophosSource.config as SophosPartnerConfig;

        const connector = new SophosPartnerConnector(
            partnerConfig,
            process.env.SECRET_KEY!
        );
        const health = await connector.checkHealth();
        if (!health) {
            return Debug.error({
                module: "SophosPartnerAdapter",
                context: "handleLicenseSync",
                message: `Connector failed health check: ${props.dataSource._id}`,
            });
        }

        // Call both license methods with tenant config
        const tenantConfig = props.dataSource.config as SophosTenantConfig;
        const [generalLicensesResult, firewallLicensesResult] = await Promise.all([
            connector.getLicenses(tenantConfig),
            connector.getFirewallLicenses(tenantConfig)
        ]);

        // Check for errors
        if (generalLicensesResult.error) {
            return { error: generalLicensesResult.error };
        }
        if (firewallLicensesResult.error) {
            return { error: firewallLicensesResult.error };
        }

        console.log(generalLicensesResult)

        return {
            data: {
                data: [...generalLicensesResult.data.licenses.map((rawData) => {
                    const dataHash = Encryption.sha256(
                        JSON.stringify({
                            ...rawData,
                            lastSeenAt: undefined,
                        })
                    );

                    return {
                        externalID: rawData.id,
                        dataHash,
                        rawData,
                        siteID: props.dataSource.siteId,
                    } as DataFetchPayload;
                }),
                ...firewallLicensesResult.data.map((rawData) => {
                    const dataHash = Encryption.sha256(
                        JSON.stringify({
                            ...rawData,
                            lastSeenAt: undefined
                        })
                    );

                    return {
                        externalID: rawData.serialNumber,
                        dataHash,
                        rawData,
                        siteID: props.dataSource.siteId
                    } as DataFetchPayload;
                })],
                hasMore: false
            }
        };
    }
}
