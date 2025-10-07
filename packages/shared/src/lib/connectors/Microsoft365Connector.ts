import { ClientSecretCredential } from "@azure/identity";
import { Client } from "@microsoft/microsoft-graph-client";
import { IConnector } from "@workspace/shared/lib/connectors/index.js";
import Debug from "@workspace/shared/lib/Debug.js";
import { APIResponse } from "@workspace/shared/types/api.js";
import { MSGraphGroup } from "@workspace/shared/types/integrations/microsoft-365/groups.js";
import { MSGraphIdentity } from "@workspace/shared/types/integrations/microsoft-365/identities.js";
import { Microsoft365DataSourceConfig } from "@workspace/shared/types/integrations/microsoft-365/index.js";

export default class Microsoft365Connector implements IConnector {
  constructor(private config: Microsoft365DataSourceConfig) {}

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
        code: "GRAPH_FAILURE",
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
        code: "GRAPH_FAILURE",
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
        code: "GRAPH_FAILURE",
      });
    }
  }

  private async getGraphClient(): Promise<APIResponse<Client>> {
    try {
      const credential = new ClientSecretCredential(
        this.config.tenant_id,
        process.env.NEXT_PUBLIC_MICROSOFT_CLIENT_ID!,
        process.env.NEXT_MICROSOFT_SECRET!
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
        code: "GRAPH_FAILURE",
      });
    }
  }
}
