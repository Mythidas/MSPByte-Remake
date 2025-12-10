import Debug from "@workspace/shared/lib/Debug.js";
import Encryption from "@workspace/shared/lib/Encryption.js";
import { APIResponse } from "@workspace/shared/types/api.js";
import {
  DattoRMMConfig,
  DattoRMMPagination,
} from "@workspace/shared/types/integrations/dattormm/index.js";
import { DattoRMMSite } from "@workspace/shared/types/integrations/dattormm/sites.js";

export default class DattoRMMConnector {
  private readonly apiUrl: string;

  constructor(
    private config: DattoRMMConfig,
    private encryptionKey: string,
  ) {
    // Datto RMM API base URL (typically https://pinotage-api.centrastage.net)
    this.apiUrl = this.config.url;
  }

  /**
   * Check if the API credentials are valid
   */
  async checkHealth(): Promise<APIResponse<boolean>> {
    const { data: token, error } = await this.getToken();
    if (error) return { error };
    return { data: !!token };
  }

  /**
   * Fetch all sites from Datto RMM
   */
  async getSites(): Promise<APIResponse<DattoRMMSite[]>> {
    const { data: token, error: tokenError } = await this.getToken();
    if (tokenError) return { error: tokenError };

    const sites: DattoRMMSite[] = [];
    let url = `${this.apiUrl}/api/v2/account/sites`;

    console.log(this.config);
    console.log(token);
    try {
      while (true) {
        const response = await fetch(url, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          return Debug.error({
            module: "DattoRMMConnector",
            context: "getSites",
            message: `HTTP ${response.status}: ${response.statusText}`,
          });
        }

        const data = await response.json();

        // Handle pagination - Datto RMM returns data in 'sites' array
        if (data.sites && Array.isArray(data.sites)) {
          sites.push(...data.sites);

          if (data.pageDetails && data.pageDetails.nextPageUrl) {
            url = data.pageDetails.nextPageUrl;
          } else break;
        } else {
          // No more sites to fetch
          break;
        }
      }

      return { data: sites };
    } catch (error) {
      return Debug.error({
        module: "DattoRMMConnector",
        context: "getSites",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Set a site variable in Datto RMM
   * @param siteUid - The Datto site UID
   * @param variableName - The variable name to set
   * @param value - The value to set
   */
  async setSiteVariable(
    siteUid: string,
    variableName: string,
    value: string,
  ): Promise<APIResponse<boolean>> {
    const { data: token, error: tokenError } = await this.getToken();
    if (tokenError) return { error: tokenError };

    try {
      // First, get all variables to find the variableId
      const variablesResponse = await fetch(
        `${this.apiUrl}/api/v2/site/${siteUid}/variables`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        },
      );

      if (!variablesResponse.ok && variablesResponse.status !== 404) {
        return Debug.error({
          module: "DattoRMMConnector",
          context: "setSiteVariable",
          message: `Failed to fetch variables: HTTP ${variablesResponse.status}: ${variablesResponse.statusText}`,
        });
      }

      let variableId: string | null = null;

      if (variablesResponse.ok) {
        const variables = await variablesResponse.json();
        const matchingVariable = variables.find(
          (v: any) => v.name === variableName,
        );
        if (matchingVariable) {
          variableId = matchingVariable.id;
        }
      }

      let response;
      if (variableId) {
        // Update existing variable using variableId
        response = await fetch(
          `${this.apiUrl}/api/v2/site/${siteUid}/variable/${variableId}`,
          {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              value: value,
            }),
          },
        );
      } else {
        // Create new variable (no variableId in path)
        response = await fetch(
          `${this.apiUrl}/api/v2/site/${siteUid}/variable`,
          {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              name: variableName,
              value: value,
            }),
          },
        );
      }

      if (!response.ok) {
        return Debug.error({
          module: "DattoRMMConnector",
          context: "setSiteVariable",
          message: `HTTP ${response.status}: ${response.statusText}`,
        });
      }

      return { data: true };
    } catch (error) {
      return Debug.error({
        module: "DattoRMMConnector",
        context: "setSiteVariable",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Get a site variable from Datto RMM
   * @param siteUid - The Datto site UID
   * @param variableName - The variable name to retrieve
   */
  async getSiteVariable(
    siteUid: string,
    variableName: string,
  ): Promise<APIResponse<string | null>> {
    const { data: token, error: tokenError } = await this.getToken();
    if (tokenError) return { error: tokenError };

    try {
      // First, get all variables to find the variableId
      const variablesResponse = await fetch(
        `${this.apiUrl}/api/v2/site/${siteUid}/variables`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        },
      );

      if (!variablesResponse.ok) {
        if (variablesResponse.status === 404) {
          // Variable doesn't exist
          return { data: null };
        }
        return Debug.error({
          module: "DattoRMMConnector",
          context: "getSiteVariable",
          message: `HTTP ${variablesResponse.status}: ${variablesResponse.statusText}`,
        });
      }

      const variables = await variablesResponse.json();
      const matchingVariable = variables.find(
        (v: any) => v.name === variableName,
      );

      if (!matchingVariable) {
        // Variable doesn't exist
        return { data: null };
      }

      // Get the specific variable using variableId
      const response = await fetch(
        `${this.apiUrl}/api/v2/site/${siteUid}/variable/${matchingVariable.id}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        },
      );

      if (!response.ok) {
        if (response.status === 404) {
          // Variable doesn't exist
          return { data: null };
        }
        return Debug.error({
          module: "DattoRMMConnector",
          context: "getSiteVariable",
          message: `HTTP ${response.status}: ${response.statusText}`,
        });
      }

      const data = await response.json();
      return { data: data.value || null };
    } catch (error) {
      return Debug.error({
        module: "DattoRMMConnector",
        context: "getSiteVariable",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  private async getToken(): Promise<APIResponse<string>> {
    try {
      // Decrypt credentials
      const apiKey = this.config.apiKey;
      const apiSecretKey = await Encryption.decrypt(
        this.config.apiSecretKey,
        this.encryptionKey,
      );

      if (!apiKey || !apiSecretKey) {
        return Debug.error({
          module: "DattoRMMConnector",
          context: "getToken",
          message: "Failed to decrypt API credentials",
        });
      }

      const response = await fetch(`${this.config.url}/auth/oauth/token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization:
            "Basic " + Buffer.from("public-client:public").toString("base64"),
        },
        body: new URLSearchParams({
          grant_type: "password",
          username: apiKey,
          password: apiSecretKey,
        }),
      });

      if (!response.ok) {
        return Debug.error({
          module: "DattoRMMConnector",
          context: "getToken",
          message: `HTTP ${response.status}: ${response.statusText}`,
        });
      }

      const data: { access_token: string } = await response.json();
      return { data: data.access_token };
    } catch (error) {
      return Debug.error({
        module: "DattoRMMConnector",
        context: "getToken",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
}
