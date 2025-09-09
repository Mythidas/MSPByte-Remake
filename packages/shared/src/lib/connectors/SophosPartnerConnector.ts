import Debug from "@workspace/shared/lib/Debug";
import Encryption from "@workspace/shared/lib/Encryption";
import { APIResponse } from "@workspace/shared/types/api";
import { SophosPartnerEndpoint } from "@workspace/shared/types/source/sophos-partner/endpoints.js";
import {
  SophosPartnerConfig,
  SophosTenantConfig,
} from "@workspace/shared/types/source/sophos-partner/index.js";
import { SophosPartnerTenant } from "@workspace/shared/types/source/sophos-partner/tenants.js";

export default class SophosPartnerConnector {
  private token: string | null = null;
  private expiration: Date = new Date();

  constructor(private config: SophosPartnerConfig) {}

  async checkHealth(): Promise<boolean> {
    return true;
  }

  async getTenants(): Promise<APIResponse<SophosPartnerTenant[]>> {
    try {
      const { data: token } = await this.getToken();
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
          const error = await response.text();
          throw new Error(
            `Failed to get Sophos Tenants: ${response.status} - ${error}`
          );
        }

        const data = await response.json();
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
    tenantId: string,
    config: SophosTenantConfig
  ): Promise<APIResponse<SophosPartnerEndpoint[]>> {
    try {
      const { data: token } = await this.getToken();

      const path = "/endpoint/v1/endpoints?pageSize=500&pageTotal=true";
      const url = config.api_host + path;

      const response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "X-Tenant-ID": tenantId,
        },
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error);
      }

      const data = await response.json();

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
        const error = await response.text();
        throw new Error(
          `Failed to get Sophos Partner ID: ${response.status} - ${error}`
        );
      }

      const data = await response.json();
      return {
        data: data.id as string,
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

      const clientId = this.config["client_id"];
      const clientSecret = await Encryption.decrypt(
        this.config["client_secret"]
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
        const error = await response.text();
        throw new Error(
          `Failed to get Sophos token: ${response.status} - ${error}`
        );
      }
      const data = await response.json();
      this.expiration = new Date(new Date().getTime() + data.expires_in * 1000);

      return {
        data: data.access_token as string,
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
