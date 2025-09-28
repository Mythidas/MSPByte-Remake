"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
import Link from "next/link";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { Box, ChevronDown, Users, Shield, Plug } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@workspace/ui/components/button";
import { signout } from "@/lib/actions/auth";
import { useAuthStore } from "@/lib/stores/auth";
import ModeToggle from "@/components/ModeToggle";

const navigationItems = [
  { href: "/", label: "Home" },
  { href: "/sites", label: "Sites" },
];

const adminItems = [
  { href: "/users", label: "Users", icon: Users },
  { href: "/roles", label: "Roles", icon: Shield },
  { href: "/integrations", label: "Integrations", icon: Plug },
];

export default function RootNavbar() {
  const user = useAuthStore((s) => s.user);
  const pathname = usePathname();
  const [isAdminOpen, setIsAdminOpen] = useState(false);

  const isActive = (href: string) => {
    if (href === "/") {
      return pathname === "/";
    }
    return pathname.startsWith(href);
  };

  const isAdminRoute = adminItems.some((item) =>
    pathname.startsWith(item.href)
  );

  return (
    <nav className="flex shrink z-50 w-full border-b border-border shadow bg-background">
      <div className="flex w-full h-14 px-4 items-center justify-between">
        <div className="flex items-center gap-6 w-fit">
          <Link
            href="/"
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <Box className="h-6 w-6" />
          </Link>

          <div className="flex items-center gap-1">
            {navigationItems.map((item) => (
              <Link key={item.href} href={item.href}>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "h-9 px-3 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
                    isActive(item.href)
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground"
                  )}
                >
                  {item.label}
                </Button>
              </Link>
            ))}

            {/* Admin Dropdown */}
            <div className="relative">
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "h-9 px-3 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
                  isAdminRoute
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground"
                )}
                onClick={() => setIsAdminOpen(!isAdminOpen)}
                onBlur={() => setTimeout(() => setIsAdminOpen(false), 200)}
              >
                Admin
                <ChevronDown
                  className={cn(
                    "ml-1 h-3 w-3 transition-transform duration-200",
                    isAdminOpen && "rotate-180"
                  )}
                />
              </Button>

              {isAdminOpen && (
                <div className="absolute top-full left-0 mt-1 w-48 rounded-md border bg-popover p-1 text-popover-foreground shadow-lg animate-in fade-in-0 zoom-in-95">
                  {adminItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link key={item.href} href={item.href}>
                        <Button
                          variant="ghost"
                          size="sm"
                          className={cn(
                            "w-full justify-start h-8 px-2 text-sm font-normal",
                            isActive(item.href)
                              ? "bg-accent text-accent-foreground"
                              : "text-muted-foreground hover:text-foreground"
                          )}
                          onClick={() => setIsAdminOpen(false)}
                        >
                          <Icon className="mr-2 h-4 w-4" />
                          {item.label}
                        </Button>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <ModeToggle />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              {user ? (
                <Button variant="ghost" size="sm" className="h-9 px-3">
                  {user.email}
                </Button>
              ) : (
                <Skeleton className="w-24 h-9 rounded-md" />
              )}
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <Link href="/">
                  <DropdownMenuItem>Home</DropdownMenuItem>
                </Link>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={signout}>Sign out</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </nav>
  );
}
