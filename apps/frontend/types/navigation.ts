import { LucideIcon } from "lucide-react";

export type NavItem = {
    label: string;
    href: string;
    icon?: LucideIcon;
    badge?: string;
    children?: NavItem[];
};

export type ModeNavConfig = {
    modeSlug: string;
    items: NavItem[];
};
