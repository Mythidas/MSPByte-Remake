import {
    LayoutDashboard,
    Building2,
    Users,
    Shield,
    Plug,
    ScrollText,
    UserCog,
    UsersRound,
    ShieldCheck,
    Key
} from "lucide-react";
import { ModeNavConfig } from "@/types/navigation";

const defaultModeConfig: ModeNavConfig = {
    modeSlug: "default",
    items: [
        {
            label: "Dashboard",
            href: "/secure/default",
            icon: LayoutDashboard,
        },
        {
            label: "Sites",
            href: "/secure/default/sites",
            icon: Building2,
        },
        {
            label: "Admin",
            href: "#",
            icon: Shield,
            children: [
                {
                    label: "Users",
                    href: "/secure/default/users",
                    icon: Users,
                },
                {
                    label: "Roles",
                    href: "/secure/default/roles",
                    icon: UserCog,
                },
            ],
        },
        {
            label: "Integrations",
            href: "/secure/default/integrations",
            icon: Plug,
        },
    ],
};

const microsoft365ModeConfig: ModeNavConfig = {
    modeSlug: "microsoft-365",
    items: [
        {
            label: "Users",
            href: "/secure/microsoft-365/users",
            icon: Users,
        },
        {
            label: "Groups",
            href: "/secure/microsoft-365/groups",
            icon: UsersRound,
        },
        {
            label: "Roles",
            href: "/secure/microsoft-365/roles",
            icon: UserCog,
        },
        {
            label: "Policies",
            href: "/secure/microsoft-365/policies",
            icon: ShieldCheck,
        },
        {
            label: "Licenses",
            href: "/secure/microsoft-365/licenses",
            icon: Key,
        },
    ],
};

export const navigationConfigs: Record<string, ModeNavConfig> = {
    default: defaultModeConfig,
    "microsoft-365": microsoft365ModeConfig,
};

export function getNavigationForMode(modeSlug: string | null): ModeNavConfig {
    const slug = modeSlug || "default";
    return navigationConfigs[slug] || defaultModeConfig;
}
