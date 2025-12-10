"use client";

import Link from "next/link";
import { UserMenu } from "./UserMenu";
import { SiteSelector } from "./SiteSelector";

export function TopNavbar() {
  return (
    <header className="sticky top-0 z-50 w-full shadow">
      <div className="flex h-14 w-full items-center justify-between bg-card/60 gap-4 p-2 rounded shadow border">
        {/* Left: Logo + Site Selector */}
        <Link href="/secure" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <span className="text-lg font-bold text-primary-foreground">M</span>
          </div>
          <span className="hidden text-2xl font-semibold sm:inline-block">
            MSPByte
          </span>
        </Link>

        <SiteSelector />

        {/* Right: Navigation + User Menu */}
        <div className="flex items-center gap-2">
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
