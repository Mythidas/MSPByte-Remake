import { createHash } from "node:crypto";
import { fileURLToPath } from "url";
import { dirname } from "path";

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

export function isVersionGte(value: string, target: string): boolean {
    const splitV1 = value.split(".").map(Number);
    const splitV2 = target.split(".").map(Number);

    const len = Math.max(splitV1.length, splitV2.length);

    for (let i = 0; i < len; i++) {
        const num1 = splitV1[i] ?? 0; // default to 0 if undefined
        const num2 = splitV2[i] ?? 0;

        if (num1 > num2) return true;
        if (num1 < num2) return false;
        // if equal, continue to next part
    }

    // all parts equal
    return true;
}

const __filename = fileURLToPath(import.meta.url);
export const __dirname = dirname(__filename);
