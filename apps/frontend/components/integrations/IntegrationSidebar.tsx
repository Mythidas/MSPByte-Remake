"use client";

import { NavGroup } from "@/components/SideNavbar/NavGroup";
import { NavItem as NavItemComponent } from "@/components/SideNavbar/NavItem";
import { NavItem } from "@/lib/types/navigation";
import { ComponentType } from "react";

type IntegrationSidebarProps = {
  navItems: NavItem[];
  integration: {
    _id: string;
    name: string;
    slug: string;
  };
  dataSource?: {
    status: string;
  };
  CustomFooter?: ComponentType<{
    integration: any;
    dataSource: any;
  }>;
};

export function IntegrationSidebar({
  navItems,
  integration,
  dataSource,
  CustomFooter,
}: IntegrationSidebarProps) {
  console.log(navItems);

  return (
    <div className="flex flex-col p-2 w-38 h-full bg-card/50 border shadow rounded justify-between">
      <div className="flex flex-col">
        {(navItems || []).map((item, idx) => {
          if (item.children && item.children.length > 0) {
            return <NavGroup key={idx} item={item} />;
          }
          return <NavItemComponent key={idx} item={item} />;
        })}
      </div>
      {CustomFooter && (
        <div className="mt-auto pt-2 border-t">
          <CustomFooter integration={integration} dataSource={dataSource} />
        </div>
      )}
    </div>
  );
}
