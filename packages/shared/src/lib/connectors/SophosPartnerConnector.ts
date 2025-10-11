import { IConnector } from "@workspace/shared/lib/connectors/index.js";
import Debug from "@workspace/shared/lib/Debug.js";
import Encryption from "@workspace/shared/lib/Encryption.js";
import { APIResponse } from "@workspace/shared/types/api.js";
import { SophosPartnerEndpoint } from "@workspace/shared/types/integrations/sophos-partner/endpoints.js";
import {
  SophosPartnerConfig,
  SophosPartnerAPIResponse,
  SophosTenantConfig,
} from "@workspace/shared/types/integrations/sophos-partner/index.js";
import { SophosPartnerTenant } from "@workspace/shared/types/integrations/sophos-partner/tenants.js";

export default class SophosPartnerConnector implements IConnector {
  private token: string | null = null;
  private expiration: Date = new Date();

  constructor(
    private config: SophosPartnerConfig,
    private encryptionKey: string
  ) {}

  async checkHealth(): Promise<APIResponse<boolean>> {
    const { data: token, error: tokenError } = await this.getToken();
    if (tokenError) return { error: tokenError };
    return { data: !!token };
  }

  async getTenants(): Promise<APIResponse<SophosPartnerTenant[]>> {
    try {
      const { data: token, error: tokenError } = await this.getToken();
      if (tokenError) return { error: tokenError };

      const sophosPartner = await this.getPartnerID();
      if (sophosPartner.error) {
        throw new Error(sophosPartner.error.message);
      }

      const tenants = [];
      const url = "https://api.central.sophos.com/partner/v1/tenants";

      let page = 1;
      while (true) {
        const response = await fetch(
          `${url}?pageTotal=true&pageSize=100&page=${page}`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
              "X-Partner-ID": sophosPartner.data,
            },
          }
        );

        if (!response.ok) {
          return Debug.error({
            module: "SophosPartnerConnector",
            context: "getTenants",
            message: `HTTP ${response.status}: ${response.statusText}`,
            code: response.status,
          });
        }

        const data: SophosPartnerAPIResponse<SophosPartnerTenant> =
          await response.json();
        tenants.push(...data.items);

        if (data.pages.current >= data.pages.total) {
          break;
        }
        page++;
      }

      return {
        data: tenants.sort((a, b) => a.name.localeCompare(b.name)),
      };
    } catch (err) {
      return Debug.error({
        module: "SophosPartnerConnector",
        context: "getTenants",
        message: String(err),
        code: "SOPHOS_API_FAILURE",
      });
    }
  }

  async getEndpoints(
    config: SophosTenantConfig
  ): Promise<APIResponse<SophosPartnerEndpoint[]>> {
    try {
      const { data: token, error: tokenError } = await this.getToken();
      if (tokenError) return { error: tokenError };

      const path = "/endpoint/v1/endpoints?pageSize=500&pageTotal=true";
      const url = config.apiHost + path;

      const response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "X-Tenant-ID": config.tenantId,
        },
      });

      if (!response.ok) {
        return Debug.error({
          module: "SophosPartnerConnector",
          context: "getEndpoints",
          message: `HTTP ${response.status}: ${response.statusText}`,
          code: response.status,
        });
      }

      const data: SophosPartnerAPIResponse<SophosPartnerEndpoint> =
        await response.json();

      return {
        data: [...data.items],
      };
    } catch (err) {
      return Debug.error({
        module: "SophosPartnerConnector",
        context: "getEndpoints",
        message: String(err),
        code: "SOPHOS_API_FAILURE",
      });
    }
  }

  private async getPartnerID(): Promise<APIResponse<string>> {
    try {
      const { data: token } = await this.getToken();

      const response = await fetch("https://api.central.sophos.com/whoami/v1", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        return Debug.error({
          module: "SophosPartnerConnector",
          context: "getPartnerID",
          message: `HTTP ${response.status}: ${response.statusText}`,
          code: response.status,
        });
      }

      const data: { id: string } = await response.json();

      return {
        data: data.id,
      };
    } catch (err) {
      return Debug.error({
        module: "SophosPartnerConnector",
        context: "getPartnerID",
        message: String(err),
        code: "SOPHOS_API_FAILURE",
      });
    }
  }

  private async getToken(): Promise<APIResponse<string>> {
    try {
      if (this.token) {
        const expired =
          new Date().getTime() >= this.expiration.getTime() + 5000;
        if (!expired) return { data: this.token };
      }

      const clientId = this.config.clientId;
      const clientSecret = await Encryption.decrypt(
        this.config.clientSecret,
        this.encryptionKey
      );

      const body = new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret || "",
        scope: "token",
      });

      const response = await fetch(
        "https://id.sophos.com/api/v2/oauth2/token",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: body.toString(),
        }
      );

      if (!response.ok) {
        return Debug.error({
          module: "SophosPartnerConnector",
          context: "getToken",
          message: `HTTP ${response.status}: ${response.statusText}`,
          code: response.status,
        });
      }

      const data: { expires_in: number; access_token: string } =
        await response.json();
      this.expiration = new Date(new Date().getTime() + data.expires_in * 1000);

      return {
        data: data.access_token,
      };
    } catch (err) {
      return Debug.error({
        module: "SophosPartnerConnector",
        context: "getToken",
        message: String(err),
        code: "SOPHOS_API_FAILURE",
      });
    }
  }
}
