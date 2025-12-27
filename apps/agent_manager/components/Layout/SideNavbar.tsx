"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Server,
  Building2,
  Ticket,
  Link as LinkIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navigationItems = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "Agents",
    href: "/agents",
    icon: Server,
  },
  {
    label: "Sites",
    href: "/sites",
    icon: Building2,
  },
  {
    label: "Tickets",
    href: "/tickets",
    icon: Ticket,
  },
  {
    label: "HaloPSA",
    href: "/halopsa",
    icon: LinkIcon,
  },
];

export function SideNavbar() {
  const pathname = usePathname();

  return (
    <div className="w-64 border-r bg-card/50 flex flex-col">
      <div className="p-4 border-b">
        <h2 className="font-semibold text-lg">MSP Agent</h2>
        <p className="text-xs text-muted-foreground">Management Dashboard</p>
      </div>
      <nav className="flex-1 p-2">
        <ul className="space-y-1">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <Icon className="w-5 h-5" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
