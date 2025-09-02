"use client";

import { Button } from "@workspace/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
import { signout } from "@/lib/actions/auth";
import ModeToggle from "@workspace/ui/components/ModeToggle";
import Link from "next/link";
import { useAuthStore } from "@/lib/stores/auth-store";
import { Skeleton } from "@workspace/ui/components/skeleton";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@workspace/ui/components/navigation-menu";
import { Box } from "lucide-react";

export default function RootNavbar() {
  const user = useAuthStore((s) => s.user);

  return (
    <nav className="flex h-14 z-50 w-full border-b border-border shadow">
      <div className="flex w-full h-14 px-4 items-center justify-between">
        <div className="flex items-center gap-2 w-fit">
          <Link href="/">
            <Box />
          </Link>

          <NavigationMenu>
            <NavigationMenuList>
              <NavigationMenuItem>
                <NavigationMenuLink href="/">Home</NavigationMenuLink>
              </NavigationMenuItem>
              <NavigationMenuItem>
                <NavigationMenuTrigger>Admin</NavigationMenuTrigger>
                <NavigationMenuContent>
                  <ul className="grid w-[100px] gap-4">
                    <li>
                      <NavigationMenuLink href="/users">
                        Users
                      </NavigationMenuLink>
                      <NavigationMenuLink href="/roles">
                        Roles
                      </NavigationMenuLink>
                      <NavigationMenuLink href="/integrations">
                        Integrations
                      </NavigationMenuLink>
                    </li>
                  </ul>
                </NavigationMenuContent>
              </NavigationMenuItem>
            </NavigationMenuList>
          </NavigationMenu>
        </div>

        <div className="flex items-center">
          <ModeToggle />
          <div className="flex items-center gap-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                {user ? (
                  <Button variant="ghost">{user.username}</Button>
                ) : (
                  <Skeleton className="w-32 h-5" />
                )}
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56">
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
      </div>
    </nav>
  );
}
