import { LucideIcon } from "lucide-react";

export type NavItem = {
    label: string;
    href: string;
    params?: string;
    isExact?: boolean;
    icon?: LucideIcon;
    badge?: string;
    children?: NavItem[];
};

export type ModeNavConfig = {
    modeSlug: string;
    items: NavItem[];
};
