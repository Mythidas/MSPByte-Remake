"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { NavItem as NavItemType } from "@/lib/types/navigation";
import { NavItem } from "./NavItem";
import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";

interface NavGroupProps {
  item: NavItemType;
}

export function NavGroup({ item }: NavGroupProps) {
  const pathname = usePathname();
  const Icon = item.icon;
  const isChildActive = (item.children || []).some((i) =>
    i.isExact ? pathname === i.href : pathname.includes(i.href),
  );
  const [isExpanded, setIsExpanded] = useState(isChildActive);

  return (
    <div>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors w-full",
          "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
        )}
      >
        {Icon && <Icon className="size-4 shrink-0" />}
        <span className="flex-1 text-left">{item.label}</span>
        {item.badge && (
          <span className="px-2 py-0.5 text-xs rounded-full bg-primary/20 text-primary">
            {item.badge}
          </span>
        )}
        <ChevronDown
          className={cn(
            "size-4 shrink-0 transition-transform",
            isExpanded && "rotate-180",
          )}
        />
      </button>
      {isExpanded && item.children && (
        <div className="mt-1 space-y-1">
          {item.children.map((child, idx) => (
            <NavItem key={idx} item={child} isNested />
          ))}
        </div>
      )}
    </div>
  );
}
