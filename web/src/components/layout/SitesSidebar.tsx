"use client";

import {
  BarChart3,
  Building2,
  Puzzle,
  Settings,
  LucideProps,
  Logs,
  Box,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ForwardRefExoticComponent, RefAttributes } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Tables } from "@workspace/shared/types/database";
import { cn } from "@/lib/utils";
import SearchBox from "@/components/ui/SearchBox";
import { Separator } from "@/components/ui/separator";

type NavItem = {
  label: string;
  icon: ForwardRefExoticComponent<
    Omit<LucideProps, "ref"> & RefAttributes<SVGSVGElement>
  >;
  href: (sourceId: string) => string;
  children?: NavItem[];
  parentOnly?: boolean;
  siteOnly?: boolean;
  sourceOnly?: boolean;
};

const navItems: NavItem[] = [
  {
    label: "Dashboard",
    icon: BarChart3,
    href: () => "/",
  },
];

type Props = {
  site?: Tables<"sites">;
  children: React.ReactNode;
};

export default function SitesSidebar({ site, children }: Props) {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  const isOnSettings = segments.includes("settings");
  const isGroupedPage = segments.includes("grouped");
  const isOnChildren = segments.includes("children");
  const isOnActivity = segments.includes("activity");
  const isSource =
    !isOnSettings && !isGroupedPage && !isOnChildren && !isOnActivity;

  return (
    <div className="flex size-full">
      <Sidebar className="relative h-full">
        <SidebarHeader>
          <SearchBox options={[{ label: "Test", value: "Test" }]} />
        </SidebarHeader>
        <Separator />
        <SidebarContent className="bg-background p-2">
          <SidebarMenu>
            {navItems.map((item) => {
              const baseHref = `/sites/${site?.id || ""}`;

              const isActive =
                (item.label === "Settings" && isOnSettings) ||
                (item.label === "Grouped" && isGroupedPage) ||
                (item.label === "Children" && isOnChildren) ||
                (item.label === "Activity" && isOnActivity) ||
                (item.label === "Source" && isSource);
              const Icon = item.icon;

              return (
                <SidebarMenuItem key={item.label}>
                  <SidebarMenuButton asChild>
                    <Link
                      href={baseHref}
                      className={cn(
                        isActive && "bg-primary text-primary-foreground"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarContent>
      </Sidebar>

      <div className="flex flex-col relative size-full gap-4 p-6 overflow-hidden">
        {children}
      </div>
    </div>
  );
}
