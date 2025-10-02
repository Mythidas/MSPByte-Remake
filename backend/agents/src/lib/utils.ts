import { createHash } from "node:crypto";

export function generateAgentGuid(
  providedGuid: string | undefined,
  macAddress: string | undefined,
  hostname: string,
  siteId: string
): string {
  // Always respect user-provided GUID first
  if (providedGuid) {
    return providedGuid;
  }

  // Prioritize MAC address as it's the most unique hardware identifier
  if (macAddress && macAddress.trim() !== "") {
    return createHash("sha256")
      .update(JSON.stringify({ mac: macAddress, siteId }))
      .digest("hex");
  }

  // Fallback to hostname + siteId
  return createHash("sha256")
    .update(JSON.stringify({ hostname, siteId }))
    .digest("hex");
}
