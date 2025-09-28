import APIClient from "@workspace/shared/lib/APIClient";
import Debug from "@workspace/shared/lib/Debug";
import { APIResponse } from "@workspace/shared/types/api";
import {
  HaloPSAConfig,
  HaloPSAPagination,
} from "@workspace/shared/types/integrations/halopsa";
import { HaloPSASite } from "@workspace/shared/types/integrations/halopsa/sites";
import { HaloPSANewTicket } from "@workspace/shared/types/integrations/halopsa/tickets";

export class HaloPSAConnector {
  constructor(private config: HaloPSAConfig) {}

  async checkHealth(): Promise<APIResponse<boolean>> {
    return { data: true };
  }

  async getSites(): Promise<APIResponse<HaloPSASite[]>> {
    const { data: token, error: tokenError } = await this.getToken();
    if (tokenError) return { error: tokenError };

    const params = new URLSearchParams();
    params.set("exclude_internal", "false");
    params.set("includeserviceaccount", "true");
    params.set("includenonserviceaccount", "true");
    params.set("includeinactive", "false");
    params.set("includecolumns", "false");
    params.set("showcounts", "true");
    params.set("paginate", "true");
    params.set("page_size", "50");
    params.set("page_no", "1");

    const sites: HaloPSASite[] = [];

    const { data, error } = await APIClient.fetch<
      HaloPSAPagination & { sites: HaloPSASite[] }
    >(`${this.config.url}/api/site?${params}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
    if (error) return { error };
    sites.push(...data.sites);
    params.set("page_no", `${data.page_no + 1}`);

    while (sites.length < data.record_count) {
      const refetch = await APIClient.fetch<
        HaloPSAPagination & { sites: HaloPSASite[] }
      >(`${this.config.url}/api/site?${params}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (refetch.data) {
        sites.push(...refetch.data.sites);
        params.set("page_no", `${refetch.data.page_no + 1}`);
      } else break;
    }

    return {
      data: sites,
    };
  }

  async createTicket(ticket: HaloPSANewTicket): Promise<APIResponse<string>> {
    const { data: token, error: tokenError } = await this.getToken();
    if (tokenError) return { error: tokenError };

    const images = ticket.images
      .map((image) => {
        return `<img src=\"${image}\" class=\"fr-fil fr-dib\" width=\"720\" height=\"374\">`;
      })
      .join("<br>");
    const details: string[] = [];
    details.push("[User Submitted Request]");
    details.push(`Summary: ${ticket.summary}`);
    details.push("");
    details.push(`Name: ${ticket.user.name}`);
    details.push(`Email: ${ticket.user.email}`);
    details.push(`Phone: ${ticket.user.phone}`);
    details.push(`Details: ${ticket.details}`);
    const details_html = `<p>${details.join("<br>")}<br>${images}</p>`;

    const { data, error } = await APIClient.fetch<{ id: string }>(
      `${this.config.url}/api/tickets`,
      {
        method: "POST",
        headers: {
          Auhtorization: `Bearer ${token}`,
          "Content-Type": "application/json-patch+json",
        },
        body: JSON.stringify([
          {
            site_id: ticket.siteId,
            matched_rule_id: 9,
            matched_rule_ids: "9",
            priority_id: 4,
            files: null,
            usertype: 1,
            tickettype_id: 1,
            timerinuse: false,
            itil_tickettype_id: "-1",
            tickettype_group_id: "-1",
            summary: ticket.summary,
            details_html,
            category_1: "AEM Alert",
            impact: "3",
            urgency: "3",
            donotapplytemplateintheapi: true,
            utcoffset: 300,
            form_id: "newticket-1",
            dont_do_rules: true,
            return_this: true,
            attachments: [],
            phonenumber: "Unknown",
            assets: ticket.assets.map((a) => ({ id: a })),
          },
        ]),
      }
    );

    if (error) return { error };
    return {
      data: data.id,
    };
  }

  async uploadImage(file: Blob): Promise<APIResponse<string>> {
    const { data: token, error: tokenError } = await this.getToken();
    if (tokenError) return { error: tokenError };

    const formData = new FormData();
    formData.append("ticket_id", "");
    formData.append("image_upload_id", "0");
    formData.append("image_upload_key", "");
    formData.append("file", file, "upload.png");

    const { data, error } = await APIClient.fetch<string>(
      `${this.config.url}/api/attachment/image`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      },
      "HaloPSAConnector"
    );

    if (error) return { error };
    return { data };
  }

  private async getToken(): Promise<APIResponse<string>> {
    const { data, error } = await APIClient.fetch<{ access_token: string }>(
      `${this.config.url}/auth/token`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "client_credentials",
          client_id: this.config.client_id,
          client_secret: this.config.client_secret,
          scope: "all",
        }),
      },
      "HaloPSAConnector"
    );

    if (error) {
      return Debug.error({
        module: "HaloPSAConnector",
        context: "getToken",
        message: `Failed to fetch token: ${error.message}`,
        code: "TOKEN_FAILURE",
      });
    }
    return { data: data.access_token };
  }
}
