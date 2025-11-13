import { Doc, Id } from "@/lib/api";

export type Site = Doc<"sites">;
export type Integration = Doc<"integrations">;
export type DataSource = Doc<"data_sources">;
export type EntityType = "companies" | "endpoints" | "identities" | "firewalls" | "groups" | "roles" | "policies" | "licenses";

export interface ModeConfig {
    id: string; // Integration slug
    name: string;
    integrationId: Id<"integrations">;
    entityTypes: EntityType[];
    color?: string;
    icon?: string;
    isCustom: boolean; // Has custom UI implementation
}

export interface WardState {
    currentSite: Site | null;
    currentMode: string | null; // 'home' | integration slug
    sites: Site[];
    availableModes: ModeConfig[];
}
