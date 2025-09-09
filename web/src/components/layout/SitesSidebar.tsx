"use client";

import {
  BarChart3,
  Building2,
  Users,
  Shield,
  Monitor,
  Mail,
  Ticket,
  FileText,
  Activity,
  Settings,
  Globe,
  Server,
  Key,
  DollarSign,
  LucideProps,
  Computer,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ForwardRefExoticComponent,
  RefAttributes,
  useMemo,
  useState,
} from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Tables } from "@workspace/shared/types/database";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import SearchBox from "@/components/SearchBox";
import { useLazyLoad } from "@/lib/hooks/useLazyLoad";
import { getRows } from "@/lib/supabase/orm";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

type NavItem = {
  id: string;
  label: string;
  icon: ForwardRefExoticComponent<
    Omit<LucideProps, "ref"> & RefAttributes<SVGSVGElement>
  >;
  href: (siteSlug: string) => string;
  integrations?: string[];
  count?: number;
  alwaysShow?: boolean;
};

type Props = {
  site: Tables<"sites_view">;
  children: React.ReactNode;
};

// Integration metadata mapping
const integrationMeta = {
  m365: {
    name: "Microsoft 365",
    icon: Mail,
    category: "productivity",
    entityTypes: [
      "user",
      "license",
      "group",
      "security_policy",
      "conditional_access_policy",
    ],
  },
  "google-workspace": {
    name: "Google Workspace",
    icon: Mail,
    category: "productivity",
    entityTypes: ["user", "license", "group"],
  },
  "datto-rmm": {
    name: "Datto RMM",
    icon: Monitor,
    category: "rmm",
    entityTypes: ["endpoint", "monitoring_data", "alert", "patch", "backup"],
  },
  "sophos-central": {
    name: "Sophos Central",
    icon: Shield,
    category: "security",
    entityTypes: [
      "endpoint",
      "firewall",
      "license",
      "threat",
      "policy",
      "tenant_health",
    ],
  },
  autotask: {
    name: "AutoTask PSA",
    icon: Ticket,
    category: "psa",
    entityTypes: ["ticket", "contract", "time_entry", "billing", "company"],
  },
  connectwise: {
    name: "ConnectWise",
    icon: Ticket,
    category: "psa",
    entityTypes: ["ticket", "contract", "time_entry", "billing", "company"],
  },
} as const;

// Helper function to get entity type configuration
function getEntityTypeConfig(entityType: string): {
  icon: typeof BarChart3;
  label: string;
} {
  switch (entityType) {
    case "endpoint":
      return { icon: Monitor, label: "Assets" };
    case "user":
      return { icon: Users, label: "Identity" };
    case "license":
      return { icon: Key, label: "Licensing" };
    case "ticket":
      return { icon: Ticket, label: "Tickets" };
    case "contract":
      return { icon: FileText, label: "Contracts" };
    case "firewall":
      return { icon: Server, label: "Network" };
    case "security_policy":
    case "policy":
    case "threat":
    case "conditional_access_policy":
    case "tenant_health":
      return { icon: Shield, label: "Security" };
    case "billing":
    case "time_entry":
      return { icon: DollarSign, label: "Billing" };
    case "monitoring_data":
    case "alert":
    case "patch":
    case "backup":
      return { icon: Activity, label: "Monitoring" };
    case "group":
      return { icon: Users, label: "Groups" };
    case "company":
      return { icon: Building2, label: "Companies" };
    default:
      return {
        icon: Globe,
        label: entityType.charAt(0).toUpperCase() + entityType.slice(1),
      };
  }
}

// Helper function to format last sync time
function formatLastSync(lastSync?: string): string {
  if (!lastSync) return "Never";
  const date = new Date(lastSync);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
  return `${Math.floor(diffMins / 1440)}d ago`;
}

export default function SitesSidebar({ site, children }: Props) {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);
  const currentView = segments[segments.length - 1] || "overview";
  const [entities, setEntities] = useState<Tables<"entities">[]>([]);
  const [dataSources, setDataSources] = useState<Tables<"data_sources">[]>([]);

  const navigationItems = useMemo(() => {
    const items: NavItem[] = [
      {
        id: "overview",
        icon: BarChart3,
        label: "Overview",
        href: (slug) => `/sites/${slug}`,
        alwaysShow: true,
      },
      {
        id: "assets",
        icon: Computer,
        label: "Assets",
        href: (slug) => `/sites/${slug}/assets`,
        integrations: ["sophos-partner"],
      },
    ];

    // Get unique entity types from current site's entities
    const availableEntityTypes = new Set(
      entities.map((entity) => entity.entity_type)
    );

    // Get integrations that have data sources for this site
    const activeIntegrations = dataSources.map((ds) => ds.integration_id);

    // Create entity type groups with their providing integrations
    const entityTypeGroups = new Map<string, string[]>();

    availableEntityTypes.forEach((entityType) => {
      const providingIntegrations = activeIntegrations.filter(
        (integrationId) => {
          const meta =
            integrationMeta[integrationId as keyof typeof integrationMeta];
          return meta?.entityTypes.includes(entityType as never);
        }
      );

      if (providingIntegrations.length > 0) {
        entityTypeGroups.set(entityType, providingIntegrations);
      }
    });

    // Convert entity types to navigation items, grouping similar types
    const processedTypes = new Set<string>();
    const typeGroups = new Map<string, string[]>();

    entityTypeGroups.forEach((integrations, entityType) => {
      if (processedTypes.has(entityType)) return;

      const config = getEntityTypeConfig(entityType);

      // Group similar entity types under the same nav item
      let relatedTypes = [entityType];

      // Find related types that should be grouped together
      entityTypeGroups.forEach((_, otherType) => {
        if (otherType !== entityType && !processedTypes.has(otherType)) {
          const otherConfig = getEntityTypeConfig(otherType);
          if (otherConfig.label === config.label) {
            relatedTypes.push(otherType);
          }
        }
      });

      // Mark all related types as processed
      relatedTypes.forEach((type) => processedTypes.add(type));

      // Collect all integrations for this group
      const allIntegrations = new Set<string>();
      relatedTypes.forEach((type) => {
        entityTypeGroups
          .get(type)
          ?.forEach((integration) => allIntegrations.add(integration));
      });

      typeGroups.set(config.label, relatedTypes);

      const navItem: NavItem = {
        id: relatedTypes[0]!, // Use first type as ID
        icon: config.icon,
        label: config.label,
        href: (slug) => `/sites/${slug}/${relatedTypes[0]}`,
        integrations: Array.from(allIntegrations),
        count: allIntegrations.size,
      };

      items.push(navItem);
    });

    return items;
  }, [entities, dataSources]);

  const { content } = useLazyLoad({
    fetcher: async () => {
      const { data: dataSourcesResult } = await getRows("data_sources", {
        filters: [["site_id", "eq", site.id]],
      });

      const { data: entitiesResult } = await getRows("entities", {
        filters: [["site_id", "eq", site.id]],
        sorting: [["entity_type", "asc"]],
      });

      const dataSources = dataSourcesResult?.rows || [];
      const entities = entitiesResult?.rows || [];

      setEntities(entities);
      setDataSources(dataSources);

      return {
        totalEntities: entitiesResult?.total || 0,
      };
    },
    render: (data) => {
      if (!data) {
        return <strong>Failed to get data. Please refresh</strong>;
      }

      // Get integration health status
      const integrationHealth = dataSources.map((ds) => {
        const meta =
          integrationMeta[ds.integration_id as keyof typeof integrationMeta];
        const isHealthy =
          ds.last_sync_at && new Date(ds.credential_expiration_at) > new Date();

        return {
          id: ds.integration_id,
          name: meta?.name || ds.integration_id,
          icon: meta?.icon || Globe,
          healthy: isHealthy,
          lastSync: ds.last_sync_at,
        };
      });

      return (
        <div className="flex size-full">
          <Sidebar className="relative h-full">
            <SidebarHeader>
              <SiteSearchBox />

              {/* Current Site Info */}
              <div className="mt-4">
                <div className="flex items-center">
                  <Building2 className="h-5 w-5 text-muted-foreground mr-3" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{site.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {dataSources.length} integration
                      {dataSources.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>

                {site.parent_name && (
                  <div className="mt-2 flex items-center text-xs text-muted-foreground ml-8">
                    <span>↳ {site.parent_name}</span>
                  </div>
                )}
              </div>
            </SidebarHeader>

            <Separator />

            <SidebarContent className="p-2">
              <SidebarMenu>
                {navigationItems.map((item) => {
                  const isActive =
                    currentView === item.id ||
                    (item.id === "overview" &&
                      (currentView === site.slug || currentView === "sites"));

                  const Icon = item.icon;

                  return (
                    <SidebarMenuItem key={item.id}>
                      <SidebarMenuButton asChild>
                        <Link
                          href={item.href(site.slug!)}
                          className={cn(
                            "flex items-center justify-between w-full",
                            isActive && "bg-primary text-primary-foreground"
                          )}
                        >
                          <div className="flex items-center">
                            <Icon className="h-4 w-4 mr-3" />
                            {item.label}
                          </div>
                          {item.count && (
                            <Badge variant="secondary" className="ml-2">
                              {item.count}
                            </Badge>
                          )}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>

              {/* Integration Health Section */}
              {integrationHealth.length > 0 && (
                <>
                  <Separator className="my-4" />
                  <div className="px-2">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      Integrations
                    </h4>
                    <div className="space-y-2">
                      {integrationHealth.map((integration) => (
                        <div
                          key={integration.id}
                          className="flex items-center justify-between text-xs"
                        >
                          <div className="flex items-center">
                            <div
                              className={cn(
                                "w-2 h-2 rounded-full mr-2",
                                integration.healthy
                                  ? "bg-green-500"
                                  : "bg-red-500"
                              )}
                            />
                            <integration.icon className="h-3 w-3 mr-1" />
                            <span className="truncate">{integration.name}</span>
                          </div>
                          <span className="text-muted-foreground">
                            {formatLastSync(integration.lastSync!)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Settings */}
              <div className="mt-auto pt-4">
                <Separator className="mb-2" />
                <Link
                  href={`/sites/${site.slug}/settings`}
                  className={cn(
                    "flex gap-2 w-full items-center",
                    currentView === "settings" &&
                      "bg-primary text-primary-foreground"
                  )}
                >
                  <Settings className="h-4 w-4" />
                  Site Settings
                </Link>
              </div>
            </SidebarContent>
          </Sidebar>

          <div className="flex flex-col relative size-full gap-4 p-6 overflow-hidden">
            {children}
          </div>
        </div>
      );
    },
    skeleton: () => (
      <div className="flex size-full">
        <Sidebar className="relative h-full">
          <SidebarHeader>
            <SearchBox options={[]} placeholder="Loading..." />
            <div className="mt-4">
              <div className="flex items-center">
                <Building2 className="h-5 w-5 text-muted-foreground mr-3" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{site.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {dataSources.length} integration
                    {dataSources.length !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>

              {site.parent_name && (
                <div className="mt-2 flex items-center text-xs text-muted-foreground ml-8">
                  <span>↳ {site.parent_name}</span>
                </div>
              )}
            </div>
          </SidebarHeader>
          <Separator />
          <SidebarContent className="p-2">
            <SidebarMenu>
              <SidebarMenuItem>
                <Skeleton className="h-8 w-full" />
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarContent>
        </Sidebar>
        <div className="flex flex-col relative size-full gap-4 p-6">
          {children}
        </div>
      </div>
    ),
  });

  return content;
}

function SiteSearchBox() {
  const router = useRouter();

  const { content } = useLazyLoad({
    fetcher: async () => {
      const { data: siteResult } = await getRows("sites");

      return siteResult?.rows || [];
    },
    render: (data) => {
      const handleSelect = (slug: string) => {
        if (slug) {
          router.push(`/sites/${slug}`);
        }
      };

      return (
        <SearchBox
          options={
            data?.map((site) => ({ label: site.name, value: site.slug })) || []
          }
          placeholder="Search sites..."
          onSelect={handleSelect}
        />
      );
    },
    skeleton: () => <SearchBox options={[]} placeholder="Loading..." />,
  });

  return content;
}
