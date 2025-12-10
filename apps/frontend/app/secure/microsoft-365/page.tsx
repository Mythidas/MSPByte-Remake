"use client";

import { useQuery } from "convex/react";
import { api, Doc } from "@/lib/api";
import {
  Users,
  UsersRound,
  UserCog,
  ShieldCheck,
  Key,
  AlertCircle,
  Building2,
} from "lucide-react";
import Link from "next/link";
import { useApp } from "@/lib/hooks/useApp";
import { useAuthReady } from "@/lib/hooks/useAuthReady";

export default function Microsoft365Dashboard() {
  // Get integration from context (fetched server-side)

  // Get selected site from app state
  const { site: currentSite } = useApp();

  // Ensure auth is ready before querying
  const { isLoading: authLoading, isAuthenticated } = useAuthReady();

  // Fetch primary data source
  const dataSource = useQuery(
    api.datasources.query.getBySiteAndIntegration,
    !authLoading && isAuthenticated && currentSite
      ? { siteId: currentSite._id, integrationId: "microsoft-365" }
      : "skip",
  );

  // Fetch entity counts for each type
  // Users (identities) are site-specific - filter by siteId when available
  const users = useQuery(
    api.helpers.orm.list,
    !authLoading && isAuthenticated && currentSite
      ? {
          tableName: "entities",
          index: {
            name: "by_site_type",
            params: {
              siteId: currentSite._id,
              entityType: "identities",
            },
          },
        }
      : "skip",
  ) as Doc<"entities">[] | undefined;

  // Other entities (groups, roles, policies, licenses) are tenant-wide
  // Filter by dataSourceId (tenant-level resources)
  const groups = useQuery(
    api.helpers.orm.list,
    !authLoading && isAuthenticated && dataSource && currentSite
      ? {
          tableName: "entities",
          index: {
            name: "by_data_source_type",
            params: {
              dataSourceId: dataSource._id,
              entityType: "groups",
            },
          },
        }
      : "skip",
  ) as Doc<"entities">[] | undefined;

  const roles = useQuery(
    api.helpers.orm.list,
    !authLoading && isAuthenticated && dataSource && currentSite
      ? {
          tableName: "entities",
          index: {
            name: "by_data_source_type",
            params: {
              dataSourceId: dataSource._id,
              entityType: "roles",
            },
          },
        }
      : "skip",
  ) as Doc<"entities">[] | undefined;

  const policies = useQuery(
    api.helpers.orm.list,
    !authLoading && isAuthenticated && dataSource && currentSite
      ? {
          tableName: "entities",
          index: {
            name: "by_data_source_type",
            params: {
              dataSourceId: dataSource._id,
              entityType: "policies",
            },
          },
        }
      : "skip",
  ) as Doc<"entities">[] | undefined;

  const licenses = useQuery(
    api.helpers.orm.list,
    !authLoading && isAuthenticated && dataSource && currentSite
      ? {
          tableName: "entities",
          index: {
            name: "by_data_source_type",
            params: {
              dataSourceId: dataSource._id,
              entityType: "licenses",
            },
          },
        }
      : "skip",
  ) as Doc<"entities">[] | undefined;

  // Show empty state if no site is selected
  if (!currentSite) {
    return (
      <div className="flex flex-col gap-4 items-center justify-center size-full">
        <Building2 className="w-16 h-16 text-muted-foreground" />
        <div className="text-center">
          <h2 className="text-2xl font-semibold mb-2">Select a Site</h2>
          <p className="text-muted-foreground max-w-md">
            Please select a site from the dropdown in the top navigation bar to
            view Microsoft 365 data for that site.
          </p>
        </div>
      </div>
    );
  }

  // Show not configured message if dataSource query completed but returned null
  if (dataSource === null) {
    return (
      <div className="flex flex-col gap-4 items-center justify-center size-full">
        <AlertCircle className="w-12 h-12 text-muted-foreground" />
        <p className="text-muted-foreground">
          Microsoft 365 integration not configured
        </p>
        <Link
          href="/secure/default/integrations"
          className="text-sm text-blue-500 hover:underline"
        >
          Configure Integration
        </Link>
      </div>
    );
  }

  const entityCards = [
    {
      label: "Users",
      href: "/secure/microsoft-365/users",
      icon: Users,
      count: users?.length ?? 0,
      description: "Active directory users and guests",
      loading: users === undefined,
    },
    {
      label: "Groups",
      href: "/secure/microsoft-365/groups",
      icon: UsersRound,
      count: groups?.length ?? 0,
      description: "Security and distribution groups",
      loading: groups === undefined,
    },
    {
      label: "Roles",
      href: "/secure/microsoft-365/roles",
      icon: UserCog,
      count: roles?.length ?? 0,
      description: "Directory roles and permissions",
      loading: roles === undefined,
    },
    {
      label: "Policies",
      href: "/secure/microsoft-365/policies",
      icon: ShieldCheck,
      count: policies?.length ?? 0,
      description: "Conditional access and security policies",
      loading: policies === undefined,
    },
    {
      label: "Licenses",
      href: "/secure/microsoft-365/licenses",
      icon: Key,
      count: licenses?.length ?? 0,
      description: "License assignments and SKUs",
      loading: licenses === undefined,
    },
  ];

  return (
    <div className="flex flex-col size-full gap-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Microsoft 365</h1>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Building2 className="w-4 h-4" />
          <p>{currentSite.name}</p>
        </div>
      </div>

      {/* Integration Status */}
      <div className="bg-card/50 border rounded shadow p-6">
        <div className="flex items-center justify-between">
          {dataSource ? (
            <div className="flex items-center gap-3">
              <div
                className={`w-3 h-3 rounded-full ${dataSource.status === "active" ? "bg-green-500" : "bg-yellow-500"}`}
              />
              <div>
                <h3 className="font-semibold">Integration Status</h3>
                <p className="text-sm text-muted-foreground">
                  {dataSource.status === "active"
                    ? "Active and syncing"
                    : "Configuration needed"}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="animate-pulse w-3 h-3 rounded-full bg-muted" />
              <div className="space-y-2">
                <div className="animate-pulse h-5 w-32 bg-muted rounded" />
                <div className="animate-pulse h-4 w-48 bg-muted rounded" />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Entity Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {entityCards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.label}
              href={card.href}
              className="bg-card/50 border rounded shadow p-6 hover:bg-card/70 transition-colors group"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded bg-primary/10 group-hover:bg-primary/20 transition-colors">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="font-semibold text-lg">{card.label}</h3>
                </div>
                {card.loading ? (
                  <div className="animate-pulse bg-muted rounded w-12 h-8" />
                ) : (
                  <span className="text-2xl font-bold">{card.count}</span>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {card.description}
              </p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
