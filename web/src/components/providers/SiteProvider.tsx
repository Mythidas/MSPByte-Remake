"use client";

import { useSiteStore } from "@/lib/stores/site-store";
import { Tables } from "@workspace/shared/types/database";
import { useEffect } from "react";

export function SiteProvider({
  initialSite,
  children,
}: {
  initialSite?: Tables<"sites_view">;
  children: React.ReactNode;
}) {
  const { setSite } = useSiteStore((s) => s);

  useEffect(() => {
    if (initialSite) setSite(initialSite);
  }, [initialSite]);

  return <>{children}</>;
}
