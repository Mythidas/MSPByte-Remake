"use client";

import { SiteSelector } from "@/components/SiteSelector";

export function TopNavbar() {
  return (
    <div className="border-b bg-card/50 px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-semibold">Agent Manager</h1>
      </div>
      <div className="flex items-center gap-4">
        <SiteSelector />
      </div>
    </div>
  );
}
