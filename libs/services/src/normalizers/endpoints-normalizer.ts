import { Endpoint } from "@workspace/shared/types/database/normalized.js";
import { SophosPartnerEndpoint } from "@workspace/shared/types/source/sophos-partner/endpoints.js";

export default class EndpointNormalizer {
  static normalize(integration: string, data: any[]): Endpoint[] {
    switch (integration) {
      case "sophos-partner": {
        return this.fromSophos(data);
      }
      default:
        return [];
    }
  }

  private static fromSophos(endpoints: SophosPartnerEndpoint[]) {
    return endpoints.map((endpoint) => {
      return {
        external_id: String(endpoint.id),
        external_parent_id: String(endpoint.tenant),

        type: endpoint.type === "server" ? "server" : "desktop",
        hostname: endpoint.hostname,
        os: endpoint.os.name,

        publicIPv4: "",
        internalIPv4s: endpoint.ipv4Addresses,
        macAddresses: endpoint.macAddresses,

        last_seen_at: endpoint.lastSeenAt,
      } as Endpoint;
    });
  }
}
