"use client";

import SiteOverviewPage from "@/modules/sites/components/SitesOverviewPage";
import { useSiteStore } from "@/lib/stores/site-store";

export default function SitePage() {
  const { site } = useSiteStore();

  if (!site) return <div>Loading...</div>;

  return <SiteOverviewPage site={site} />;
}
