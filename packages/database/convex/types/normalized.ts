export type Company = {
    external_id: string;
    external_parent_id?: string;

    name: string;
    parent_name?: string;
    type: "customer" | "prospect";

    created_at: string;
};

export type Endpoint = {
    external_id: string;

    hostname: string;
    status: "online" | "offline";
    os: string;

    ip_address: string;
    ext_address: string;
    mac_address: string;

    last_check_in: string;
    protectionUpgradable?: boolean;
};

export type Identity = {
    external_id: string;

    name: string;
    email: string;
    aliases: string[];
    type: "member" | "guest";
    enabled: boolean;
    state: "normal" | "warn" | "critical"; // Security posture based on active alert severity
    tags: string[]; // e.g., "MFA", "Deleted", "Locked", "Admin", "Guest", "Service", "Stale"

    licenses: string[];
    last_login_at: string;
};

export type Group = {
    external_id: string;
    external_parent_id?: string;

    name: string;
    type: "security" | "distribution" | "modern" | "custom";
    description?: string;

    created_at: string;
};

export type Firewall = {
    externalId: string;
    serial: string;

    hostname: string;
    status: "online" | "offline";
    firmware: string;
    firmwareUpgradeAvailable?: boolean;
    model: string;

    extAddress: string;
    lastSeenAt: string;
};

export type Role = {
    externalId: string;

    name: string;
    description?: string;
    status: "enabled" | "disabled";
}

export type Policy = {
    externalId: string;

    name: string;
    description?: string;
    status: "enabled" | "disabled" | "report-only";

    createdAt: number;
}

export type License = {
    externalId: string;

    name: string;
    skuPartNumber?: string;
    totalUnits?: number;
    consumedUnits?: number;
    tags?: string[]; // e.g., ["bloat"], ["overused"]
}
