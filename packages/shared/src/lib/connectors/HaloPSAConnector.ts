import Debug from "@workspace/shared/lib/Debug";
import Encryption from "@workspace/shared/lib/Encryption";
import { APIResponse } from "@workspace/shared/types/api";
import { HaloPSAAsset } from "@workspace/shared/types/integrations/halopsa/assets.js";
import {
	HaloPSAConfig,
	HaloPSAPagination,
} from "@workspace/shared/types/integrations/halopsa/index.js";
import { HaloPSASite } from "@workspace/shared/types/integrations/halopsa/sites.js";
import { HaloPSANewTicket } from "@workspace/shared/types/integrations/halopsa/tickets.js";

export default class HaloPSAConnector {
	constructor(
		private config: HaloPSAConfig,
		private encryptionKey: string
	) {}

	async checkHealth(): Promise<APIResponse<boolean>> {
		const { data: token, error: tokenError } = await this.getToken();
		if (tokenError) return { error: tokenError };
		return { data: !!token };
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

		const response = await fetch(`${this.config.url}/api/site?${params}`, {
			method: "GET",
			headers: {
				Authorization: `Bearer ${token}`,
				"Content-Type": "application/json",
			},
		});

		if (!response.ok) {
			return Debug.error({
				module: "HaloPSAConnector",
				context: "getSites",
				message: `HTTP ${response.status}: ${response.statusText}`,
			});
		}

		const data: HaloPSAPagination & { sites: HaloPSASite[] } =
			await response.json();
		sites.push(...data.sites);
		params.set("page_no", `${data.page_no + 1}`);

		while (sites.length < data.record_count) {
			const refetchResponse = await fetch(
				`${this.config.url}/api/site?${params}`,
				{
					method: "GET",
					headers: {
						Authorization: `Bearer ${token}`,
						"Content-Type": "application/json",
					},
				}
			);

			if (refetchResponse.ok) {
				const refetchData: HaloPSAPagination & { sites: HaloPSASite[] } =
					await refetchResponse.json();
				sites.push(...refetchData.sites);
				params.set("page_no", `${refetchData.page_no + 1}`);
			} else break;
		}

		return {
			data: sites,
		};
	}

	async getAssets(siteID: string) {
		type APISchema = HaloPSAPagination & { assets: HaloPSAAsset[] };

		const { data: token, error: tokenError } = await this.getToken();
		if (tokenError) return { error: tokenError };

		const params = new URLSearchParams();
		params.set("cf_display_values_only", "true");
		params.set("includeinactive", "false");
		params.set("site_id", siteID);
		params.set("includecolumns", "false");
		params.set("showcounts", "true");
		params.set("paginate", "true");
		params.set("page_size", "50");
		params.set("page_no", "1");

		const assets: HaloPSAAsset[] = [];

		const response = await fetch(`${this.config.url}/api/asset?${params}`, {
			method: "GET",
			headers: {
				Authorization: `Bearer ${token}`,
				"Content-Type": "application/json",
			},
		});

		if (!response.ok) {
			return Debug.error({
				module: "HaloPSAConnector",
				context: "getAssets",
				message: `HTTP ${response.status}: ${response.statusText}`,
			});
		}

		const data: APISchema = await response.json();
		assets.push(...data.assets);
		params.set("page_no", `${data.page_no + 1}`);

		while (assets.length < data.record_count) {
			const refetchResponse = await fetch(
				`${this.config.url}/api/asset?${params}`,
				{
					method: "GET",
					headers: {
						Authorization: `Bearer ${token}`,
						"Content-Type": "application/json",
					},
				}
			);

			if (refetchResponse.ok) {
				const refetchData: APISchema = await refetchResponse.json();
				assets.push(...refetchData.assets);
				params.set("page_no", `${refetchData.page_no + 1}`);
			} else break;
		}

		return {
			data: assets,
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

		const params = new URLSearchParams();
		params.set("includedetails", "false");
		params.set("includetickettype", "false");
		params.set("includeuser", "false");
		params.set("includepriority", "false");
		params.set("idonly", "true");

		const response = await fetch(`${this.config.url}/api/tickets?${params}`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${token}`,
				"Content-Type": "application/json-patch+json",
			},
			body: JSON.stringify([
				{
					site_id: ticket.siteId,
					priority_id: 4,
					files: null,
					usertype: 1,
					tickettype_id: "3",
					timerinuse: false,
					itil_tickettype_id: "-1",
					tickettype_group_id: "-1",
					summary: ticket.summary,
					details_html,
					category_1: "",
					impact: ticket.impact,
					urgency: ticket.urgency,
					donotapplytemplateintheapi: true,
					utcoffset: 300,
					form_id: "newticket-1",
					dont_do_rules: true,
					return_this: false,
					phonenumber: ticket.user.phone,
					assets: ticket.assets.map((a) => ({ id: a })),
				},
			]),
		});

		if (!response.ok) {
			return Debug.error({
				module: "HaloPSAConnector",
				context: "createTicket",
				message: `HTTP ${response.status}: ${response.statusText}`,
			});
		}

		const data: { id: string } = await response.json();
		return {
			data: String(data.id),
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

		const response = await fetch(`${this.config.url}/api/attachment/image`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${token}`,
			},
			body: formData,
		});

		if (!response.ok) {
			return Debug.error({
				module: "HaloPSAConnector",
				context: "uploadImage",
				message: `HTTP ${response.status}: ${response.statusText}`,
			});
		}

		const data: { link: string } = await response.json();
		return { data: data.link };
	}

	private async getToken(): Promise<APIResponse<string>> {
		try {
			const response = await fetch(`${this.config.url}/auth/token`, {
				method: "POST",
				headers: {
					"Content-Type": "application/x-www-form-urlencoded",
				},
				body: new URLSearchParams({
					grant_type: "client_credentials",
					client_id: this.config.clientId,
					client_secret:
						(await Encryption.decrypt(
							this.config.clientSecret,
							this.encryptionKey
						)) || "",
					scope: "all",
				}),
			});

			if (!response.ok) {
				return Debug.error({
					module: "HaloPSAConnector",
					context: "getToken",
					message: `HTTP ${response.status}: ${response.statusText}`,
				});
			}

			const data: { access_token: string } = await response.json();
			return { data: data.access_token };
		} catch (err) {
			return Debug.error({
				module: "HaloPSAConnector",
				context: "getToken",
				message: `Failed to get token: ${err}`,
			});
		}
	}
}
