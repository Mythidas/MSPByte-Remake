import SitesSidebar from "@/components/layout/SitesSidebar";
import { SiteProvider } from "@/components/providers/SiteProvider";
import { getRow } from "@/lib/supabase/orm";
import { ReactNode } from "react";

type Props = {
  params: Promise<{ slug: string }>;
  children: ReactNode;
};

export default async function Layout({ params, children }: Props) {
  const { slug } = await params;
  const { data: site } = await getRow("sites_view", {
    filters: [["slug", "eq", slug]],
  });

  if (!site) {
    return <strong>Failed to find site. Please refresh</strong>;
  }

  return (
    <SiteProvider initialSite={site}>
      <SitesSidebar site={site}>{children}</SitesSidebar>
    </SiteProvider>
  );
}
