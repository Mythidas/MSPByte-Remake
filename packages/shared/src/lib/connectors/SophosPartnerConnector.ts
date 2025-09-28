import APIClient from "@workspace/shared/lib/APIClient";
import Debug from "@workspace/shared/lib/Debug";
import Encryption from "@workspace/shared/lib/Encryption";
import { APIResponse } from "@workspace/shared/types/api";
import {
  SophosPartnerAPIResponse,
  SophosPartnerConfig,
  SophosTenantConfig,
} from "@workspace/shared/types/integrations/sophos-partner";
import { SophosPartnerEndpoint } from "@workspace/shared/types/integrations/sophos-partner/endpoints";
import { SophosPartnerTenant } from "@workspace/shared/types/integrations/sophos-partner/tenants";

export default class SophosPartnerConnector {
  private token: string | null = null;
  private expiration: Date = new Date();

  constructor(private config: SophosPartnerConfig) {}

  async checkHealth(): Promise<APIResponse<true>> {
    return { data: true };
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
        const { data, error } = await APIClient.fetch<
          SophosPartnerAPIResponse<SophosPartnerTenant>
        >(
          `${url}?pageTotal=true&pageSize=100&page=${page}`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
              "X-Partner-ID": sophosPartner.data,
            },
          },
          "SophosPartner"
        );

        if (error) {
          return { error };
        }

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
      const { data: token } = await this.getToken();

      const path = "/endpoint/v1/endpoints?pageSize=500&pageTotal=true";
      const url = config.api_host + path;

      const { data, error } = await APIClient.fetch<
        SophosPartnerAPIResponse<SophosPartnerEndpoint>
      >(
        url,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "X-Tenant-ID": config.tenant_id,
          },
        },
        "SophosPartner"
      );

      if (error) {
        return { error };
      }

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

      const { data, error } = await APIClient.fetch<{ id: string }>(
        "https://api.central.sophos.com/whoami/v1",
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
        "SophosPartner"
      );

      if (error) {
        return { error };
      }

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

      const { data, error } = await APIClient.fetch<{
        expires_in: number;
        access_token: string;
      }>(
        "https://id.sophos.com/api/v2/oauth2/token",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: body.toString(),
        },
        "SophosPartner"
      );

      if (error) {
        return { error };
      }
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
