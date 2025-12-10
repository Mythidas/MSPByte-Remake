import { EntityType, IntegrationId } from "./index.js";

export type Integration = {
    name: string;
    slug: string;
    description: string;
    category: string;
    is_active: boolean;
    supportedTypes: {
        isGlobal: boolean;
        priority: number;
        rateMinutes: number;
        type: EntityType;
    }[];

    color?: string;
    icon_url?: string;
    product_url?: string;
}

export const INTEGRATIONS: Record<string, Integration> = {
    "microsoft-365": {
        name: "Microsoft 365",
        slug: "microsoft-365",
        description: "Sync asset and licensing information from Microsoft 365 via Microsoft Graph API",
        category: "Identity",
        is_active: true,
        supportedTypes: [
            {
            isGlobal: false,
            priority: 5,
            rateMinutes: 30,
            type: "identities",
            },
            {
            isGlobal: false,
            priority: 10,
            rateMinutes: 720,
            type: "policies",
            },
            {
            isGlobal: false,
            priority: 5,
            rateMinutes: 1440,
            type: "roles",
            },
            {
            isGlobal: false,
            priority: 5,
            rateMinutes: 360,
            type: "groups",
            },
            {
            isGlobal: false,
            priority: 5,
            rateMinutes: 360,
            type: "licenses",
            },
        ],

        color: "#FFFFFF",
        icon_url: "https://res-1.cdn.office.net/files/fabric-cdn-prod_20230815.002/assets/brand-icons/product/svg/m365_48x1.svg",
        product_url: "https://www.microsoft.com/en-us/microsoft-365"
    },
    "halopsa": {
        name: "HaloPSA",
        slug: "halopsa",
        description: "Sync and manage business continuity from your PSA",
        category: "PSA",
        is_active: true,
        supportedTypes: [
            {
            isGlobal: true,
            priority: 5,
            rateMinutes: 1440,
            type: "companies",
            }
        ],

        color: "#F8384B",
        icon_url: "https://usehalo.com/wp-content/uploads/2025/02/HALO_Icon_PSA_PNG1K.png",
        product_url: "https://usehalo.com/halopsa/"
    }
}