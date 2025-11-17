"use client";

import { useParams } from "next/navigation";
import { Building2, AlertCircle } from "lucide-react";
import Loader from "@workspace/ui/components/Loader";
import { useQuery } from "convex/react";
import { api, Doc } from "@/lib/api";
import { useAlertsForSite } from "@/hooks/useAlertsForSite";
import { AlertsTable } from "@/components/alerts/AlertsTable";
import {
  Breadcrumb,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@workspace/ui/components/breadcrumb";

export default function SiteAlertsPage() {
  const params = useParams();
  const slug = params["slug"]?.toString() || "";

  // Fetch site by slug
  const site = useQuery(api.sites.query.getBySlug, { slug }) as Doc<"sites"> | undefined;

  // Fetch alerts for this site (across all integrations)
  const alerts = useAlertsForSite(site?._id ?? null);

  if (!site) {
    return <Loader />;
  }

  return (
    <div className="flex flex-col size-full gap-4">
      <div>
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbLink href="/secure/sites">Sites</BreadcrumbLink>
            <BreadcrumbSeparator />
            <BreadcrumbLink href={`/secure/sites/${site.slug}`}>
              {site.name}
            </BreadcrumbLink>
            <BreadcrumbSeparator />
            <BreadcrumbPage>Alerts</BreadcrumbPage>
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      <div>
        <h1 className="text-3xl font-bold tracking-tight">Site Alerts</h1>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Building2 className="w-4 h-4" />
          <p>{site.name}</p>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          All alerts across all integrations for this site
        </p>
      </div>

      {alerts !== undefined ? (
        <AlertsTable alerts={alerts} siteId={site._id} />
      ) : (
        <Loader />
      )}
    </div>
  );
}
