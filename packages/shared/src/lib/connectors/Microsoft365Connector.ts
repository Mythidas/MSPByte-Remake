import { ClientSecretCredential } from "@azure/identity";
import { Client } from "@microsoft/microsoft-graph-client";
import { IConnector } from "@workspace/shared/lib/connectors/index.js";
import Debug from "@workspace/shared/lib/Debug.js";
import { APIResponse } from "@workspace/shared/types/api.js";
import { MSGraphGroup } from "@workspace/shared/types/integrations/microsoft-365/groups.js";
import { MSGraphIdentity } from "@workspace/shared/types/integrations/microsoft-365/identities.js";
import { Microsoft365DataSourceConfig } from "@workspace/shared/types/integrations/microsoft-365/index.js";
import { MSGraphRole } from "@workspace/shared/types/integrations/microsoft-365/roles.js";
import { MSGraphConditionalAccessPolicy } from "@workspace/shared/types/integrations/microsoft-365/policies.js";

export type MSGraphSubscribedSku = {
    skuId: string;
    skuPartNumber: string;
    servicePlans: Array<{
        servicePlanId: string;
        servicePlanName: string;
    }>;
    prepaidUnits?: {
        enabled: number;
        suspended: number;
        warning: number;
    };
    consumedUnits?: number;
};

export default class Microsoft365Connector implements IConnector {
    constructor(private config: Microsoft365DataSourceConfig) { }

    async checkHealth() {
        const { data, error } = await this.getOrganization();
        if (error) return { error };
        return { data: !!data };
    }

    async getIdentities({
        cursor,
        domains,
    }: {
        domains?: string[];
        cursor?: string;
    }): Promise<APIResponse<{ identities: MSGraphIdentity[]; next?: string }>> {
        try {
            const { data: client, error: clientError } = await this.getGraphClient();
            if (clientError) return { error: clientError };

            if (cursor) {
                const response = await client.api(cursor).get();

                return {
                    data: {
                        identities: response.value,
                        next: response["@odata.nextLink"],
                    },
                };
            }

            const fields = [
                "id",
                "displayName",
                "userPrincipalName",
                "accountEnabled",
                "assignedLicenses",
                "assignedPlans",
                "userType",
                "proxyAddresses",
                "signInActivity",
            ];
            const filter = !domains
                ? ""
                : domains
                    .map((domain) => `endsWith(userPrincipalName, '@${domain}')`)
                    .join(" or ");

            const response = await client
                .api("/users")
                .select(fields.join(","))
                .header("ConsistencyLevel", "eventual")
                .orderby("userPrincipalName")
                .filter(filter)
                .get();

            return {
                data: {
                    identities: response.value,
                    next: response["@odata.nextLink"],
                },
            };
        } catch (err) {
            return Debug.error({
                module: "Microsoft365Connector",
                context: "getIdentities",
                message: `Failed to fetch: ${err}`,
            });
        }
    }

    async getGroups(): Promise<APIResponse<MSGraphGroup[]>> {
        try {
            const { data: client, error: clientError } = await this.getGraphClient();
            if (clientError) return { error: clientError };

            let query = client
                .api("/groups")
                .header("ConsistencyLevel", "eventual")
                .orderby("displayName");

            let allGroups: MSGraphGroup[] = [];
            let response = await query.get();

            allGroups = allGroups.concat(response.value);

            while (response["@odata.nextLink"]) {
                response = await client.api(response["@odata.nextLink"]).get();
                allGroups = allGroups.concat(response.value);
            }

            return {
                data: allGroups,
            };
        } catch (err) {
            return Debug.error({
                module: "Microsoft365Connector",
                context: "getGroups",
                message: `Failed to fetch: ${err}`,
            });
        }
    }

    async getRoles(
    ): Promise<APIResponse<MSGraphRole[]>> {
        try {
            const { data: client, error: clientError } = await this.getGraphClient();
            if (clientError) return { error: clientError };


            let query = client.api('/directoryRoles');

            let allRoles: MSGraphRole[] = [];
            let response = await query.get();

            allRoles = allRoles.concat(response.value);

            while (response['@odata.nextLink']) {
                response = await client.api(response['@odata.nextLink']).get();
                allRoles = allRoles.concat(response.value);
            }

            return {
                data: allRoles,
            };
        } catch (err) {
            return Debug.error({
                module: 'Microsoft365Connector',
                context: 'getRoles',
                message: String(err),
            });
        }
    }

    async getConditionalAccessPolicies(
    ): Promise<APIResponse<MSGraphConditionalAccessPolicy[]>> {
        try {
            const { data: client, error: clientError } = await this.getGraphClient();
            if (clientError) return { error: clientError };


            const securityPolicies = await client.api('/identity/conditionalAccess/policies').get();

            return {
                data: securityPolicies.value,
            };
        } catch (err) {
            return Debug.error({
                module: 'Microsoft-365',
                context: 'getConditionalAccessPolicies',
                message: String(err),
            });
        }
    }

    async getSecurityDefaultsEnabled(
    ): Promise<APIResponse<boolean>> {
        try {
            const { data: client, error: clientError } = await this.getGraphClient();
            if (clientError) return { error: clientError };


            const securityDefaults = await client
                .api('/policies/identitySecurityDefaultsEnforcementPolicy')
                .get();

            return {
                data: securityDefaults.isEnabled || false,
            };
        } catch (err) {
            return Debug.error({
                module: 'Microsoft-365',
                context: 'getSecurityDefaultsEnabled',
                message: String(err),
            });
        }
    }

    async getSubscribedSkus(): Promise<APIResponse<MSGraphSubscribedSku[]>> {
        try {
            const { data: client, error: clientError } = await this.getGraphClient();
            if (clientError) return { error: clientError };

            let allSkus: MSGraphSubscribedSku[] = [];
            let query = client.api('/subscribedSkus');
            let response = await query.get();

            allSkus = allSkus.concat(response.value);

            while (response['@odata.nextLink']) {
                response = await client.api(response['@odata.nextLink']).get();
                allSkus = allSkus.concat(response.value);
            }

            return {
                data: allSkus,
            };
        } catch (err) {
            return Debug.error({
                module: 'Microsoft365Connector',
                context: 'getSubscribedSkus',
                message: String(err),
            });
        }
    }

    async getGroupMembers(groupId: string): Promise<APIResponse<any[]>> {
        try {
            const { data: client, error: clientError } = await this.getGraphClient();
            if (clientError) return { error: clientError };

            let allMembers: any[] = [];
            let query = client.api(`/groups/${groupId}/members`);
            let response = await query.get();

            allMembers = allMembers.concat(response.value);

            while (response['@odata.nextLink']) {
                response = await client.api(response['@odata.nextLink']).get();
                allMembers = allMembers.concat(response.value);
            }

            return {
                data: allMembers,
            };
        } catch (err) {
            return Debug.error({
                module: 'Microsoft365Connector',
                context: 'getGroupMembers',
                message: String(err),
            });
        }
    }

    async getRoleMembers(roleId: string): Promise<APIResponse<any[]>> {
        try {
            const { data: client, error: clientError } = await this.getGraphClient();
            if (clientError) return { error: clientError };

            let allMembers: any[] = [];
            let query = client.api(`/directoryRoles/${roleId}/members`);
            let response = await query.get();

            allMembers = allMembers.concat(response.value);

            while (response['@odata.nextLink']) {
                response = await client.api(response['@odata.nextLink']).get();
                allMembers = allMembers.concat(response.value);
            }

            return {
                data: allMembers,
            };
        } catch (err) {
            return Debug.error({
                module: 'Microsoft365Connector',
                context: 'getRoleMembers',
                message: String(err),
            });
        }
    }

    async getOrganization(): Promise<APIResponse<any>> {
        try {
            const { data: client, error: clientError } = await this.getGraphClient();
            if (clientError) return { error: clientError };

            let query = client.api("/organization");

            let response = await query.get();

            return {
                data: response,
            };
        } catch (err) {
            return Debug.error({
                module: "Microsoft365Connector",
                context: "getGroups",
                message: `Failed to fetch: ${err}`,
            });
        }
    }

    private async getGraphClient(): Promise<APIResponse<Client>> {
        try {
            const credential = new ClientSecretCredential(
                this.config.tenantId,
                process.env.MICROSOFT_CLIENT_ID!,
                process.env.MICROSOFT_SECRET!
            );

            const client = Client.initWithMiddleware({
                authProvider: {
                    getAccessToken: async () => {
                        const tokenResponse = await credential.getToken(
                            "https://graph.microsoft.com/.default"
                        );
                        return tokenResponse?.token!;
                    },
                },
            });

            return {
                data: client,
            };
        } catch (err) {
            return Debug.error({
                module: "Microsoft365Connector",
                context: "getGraphClient",
                message: `Failed to create client: ${err}`,
            });
        }
    }
}
