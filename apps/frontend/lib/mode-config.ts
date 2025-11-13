import { ModeConfig, EntityType } from "./types";
import { Id } from "@/lib/api";

// Mode configurations for integrations
export const CUSTOM_MODES: Record<string, Partial<ModeConfig>> = {
    "microsoft-365": {
        name: "Microsoft 365",
        color: "#0078d4",
        icon: "microsoft",
        isCustom: true,
    },
    "sophos-partner": {
        name: "Sophos",
        color: "#00a8e1",
        icon: "shield",
        isCustom: false,
    },
};

/**
 * Build mode configuration from integration data
 */
export function buildModeConfig(
    integration: {
        _id: Id<"integrations">;
        slug: string;
        name: string;
        supportedTypes: Array<{ type: EntityType; isGlobal: boolean }>;
        color?: string;
    }
): ModeConfig {
    const customConfig = CUSTOM_MODES[integration.slug] || {};

    return {
        id: integration.slug,
        name: customConfig.name || integration.name,
        integrationId: integration._id,
        entityTypes: integration.supportedTypes.map((t) => t.type),
        color: customConfig.color || integration.color || "#6b7280",
        icon: customConfig.icon,
        isCustom: customConfig.isCustom || false,
    };
}
