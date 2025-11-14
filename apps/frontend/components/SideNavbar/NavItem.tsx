"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavItem as NavItemType } from "@/types/navigation";
import { cn } from "@/lib/utils";

interface NavItemProps {
    item: NavItemType;
    isNested?: boolean;
}

export function NavItem({ item, isNested = false }: NavItemProps) {
    const pathname = usePathname();
    const isActive = item.isExact ? pathname === item.href : pathname.includes(item.href);
    const Icon = item.icon;

    return (
        <Link
            href={item.href}
            className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                isNested && "pl-10",
                isActive
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
        >
            {Icon && <Icon className="size-4 shrink-0" />}
            <span className="flex-1">{item.label}</span>
            {item.badge && (
                <span className="px-2 py-0.5 text-xs rounded-full bg-primary/20 text-primary">
                    {item.badge}
                </span>
            )}
        </Link>
    );
}
