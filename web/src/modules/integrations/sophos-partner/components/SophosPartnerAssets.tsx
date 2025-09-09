"use client";

import {
  Shield,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Monitor,
  Server,
  Laptop,
  Smartphone,
  Activity,
  Wifi,
  WifiOff,
  Lock,
  LockOpen,
  Eye,
  ExternalLink,
  RefreshCw,
  Download,
  Settings,
  Zap,
  Bug,
  ShieldCheck,
  ShieldAlert,
  Wrench,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tables } from "@workspace/shared/types/database";
import { DataTable } from "@/components/DataTable/DataTable";
import fetchTableData from "@/lib/supabase/table-fetcher";
import {
  DataTableColumn,
  DataTableFetchParams,
  DataTableView,
  DataTableAction,
} from "@/lib/types/datatable";
import { cn } from "@/lib/utils";
import { useLazyLoad } from "@/lib/hooks/useLazyLoad";
import { getRows } from "@/lib/supabase/orm";
import { Skeleton } from "@/components/ui/skeleton";
import { prettyText } from "@workspace/shared/lib/utils";

type Props = {
  site: Tables<"sites_view">;
};

type SophosPartnerEndpoint = {
  id: string;
  os: {
    name: string;
    build: number;
    isServer: boolean;
    platform: string;
    majorVersion: number;
    minorVersion: number;
  };
  type: string;
  health: {
    overall: "good" | "bad" | string;
    threats: {
      status: "good" | "bad" | string;
    };
    services: {
      status: "good" | "bad" | string;
      serviceDetails: {
        name: string;
        status: "running" | "stopped" | string;
      }[];
    };
  };
  online: boolean;
  tenant: {
    id: string;
  };
  modules: {
    name: string;
    version: string;
  }[];
  hostname: string;
  lockdown: {
    status: "enabled" | "disabled" | "unavailable" | string;
  };
  packages?: {
    ztna?: {
      status: "assigned" | "unassigned" | string;
    };
    encryption?: {
      status: "assigned" | "unassigned" | string;
      available?: {
        id: string;
        name: string;
      }[];
    };
    protection?: {
      name: string;
      status: "assigned" | "unassigned" | string;
      available?: {
        id: string;
        name: string;
      }[];
      assignedId?: string;
    };
  };
  isolation: {
    status: "isolated" | "notIsolated" | string;
  };
  lastSeenAt: string;
  mdrManaged: boolean;
  macAddresses?: string[];
  ipv4Addresses?: string[];
  assignedProducts: {
    code: string;
    status: "installed" | "notInstalled" | string;
    version: string;
  }[];
  associatedPerson: {
    id: string;
    name: string;
    viaLogin: string;
  };
  tamperProtectionEnabled: boolean;
  tamperProtectionSupported: boolean;
};

// Helper functions
function getDeviceIcon(endpoint: SophosPartnerEndpoint) {
  if (endpoint.os?.isServer) return Server;
  if (endpoint.type?.toLowerCase().includes("mobile")) return Smartphone;
  if (endpoint.type?.toLowerCase().includes("laptop")) return Laptop;
  return Monitor;
}

function formatLastSeen(lastSeen: string): string {
  const date = new Date(lastSeen);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
  return `${Math.floor(diffMins / 1440)}d ago`;
}

function getHealthBadge(status: string) {
  if (status === "good") {
    return (
      <Badge variant="default" className="text-xs bg-emerald-500">
        Good
      </Badge>
    );
  } else if (status === "bad") {
    return (
      <Badge variant="destructive" className="text-xs">
        Bad
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="text-xs">
      {prettyText(status)}
    </Badge>
  );
}

export default function SophosPartnerAssets({ site }: Props) {
  const fetcher = async (params: DataTableFetchParams) => {
    const result = await fetchTableData("entities", {
      filters: [
        ["entity_type", "eq", "endpoint"],
        ["site_id", "eq", site.id],
        ["integration_id", "eq", "sophos-partner"],
      ],
      pagination: {
        ...params,
        filterMap: {
          hostname: "raw_data->>hostname",
          online: "raw_data->>online",
          health: "raw_data->health->>overall",
          tamper_protection: "raw_data->>tamperProtectionEnabled",
        },
      },
    });

    return result;
  };

  const columns: DataTableColumn<Tables<"entities">>[] = [
    {
      key: "hostname",
      label: "Hostname",
      sortable: false,
      searchable: true,
      jsonbPath: "hostname",
      render: (_, row) => {
        const endpoint = row.raw_data as SophosPartnerEndpoint;
        const DeviceIcon = getDeviceIcon(endpoint);

        return (
          <div className="flex items-center gap-3">
            <DeviceIcon className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="font-medium">{endpoint.hostname}</p>
              <p className="text-sm text-muted-foreground">
                {endpoint.os?.name}
              </p>
            </div>
          </div>
        );
      },
    },
    {
      key: "online",
      label: "Status",
      sortable: true,
      jsonbPath: "online",
      filterable: true,
      filterType: "select",
      filterOptions: [
        { label: "Online", value: "true" },
        { label: "Offline", value: "false" },
      ],
      render: (_, row) => {
        const endpoint = row.raw_data as SophosPartnerEndpoint;
        return (
          <div className="flex items-center gap-2">
            {endpoint.online ? (
              <Wifi className="h-4 w-4 text-green-500" />
            ) : (
              <WifiOff className="h-4 w-4 text-red-500" />
            )}
            <span
              className={cn(
                "text-sm font-medium",
                endpoint.online ? "text-green-600" : "text-red-600"
              )}
            >
              {endpoint.online ? "Online" : "Offline"}
            </span>
          </div>
        );
      },
    },
    {
      key: "health",
      label: "Health",
      sortable: true,
      jsonbPath: "health.overall",
      filterable: true,
      filterType: "select",
      filterOptions: [
        { label: "Good", value: "good" },
        { label: "Bad", value: "bad" },
      ],
      render: (_, row) => {
        const endpoint = row.raw_data as SophosPartnerEndpoint;
        return (
          <div className="flex items-center gap-2">
            {getHealthBadge(endpoint.health?.overall)}
            {endpoint.health?.threats?.status === "bad" && (
              <Bug className="h-4 w-4 text-red-500" />
            )}
          </div>
        );
      },
    },
    {
      key: "tamper_protection",
      label: "Tamper Protection",
      sortable: true,
      jsonbPath: "tamperProtectionEnabled",
      filterable: true,
      filterType: "select",
      filterOptions: [
        { label: "Enabled", value: "true" },
        { label: "Disabled", value: "false" },
      ],
      render: (_, row) => {
        const endpoint = row.raw_data as SophosPartnerEndpoint;
        if (!endpoint.tamperProtectionSupported) {
          return (
            <Badge variant="secondary" className="text-xs">
              Not Supported
            </Badge>
          );
        }
        return endpoint.tamperProtectionEnabled ? (
          <Badge variant="default" className="text-xs bg-emerald-500">
            <Shield className="h-3 w-3 mr-1" />
            Enabled
          </Badge>
        ) : (
          <Badge variant="destructive" className="text-xs">
            <ShieldAlert className="h-3 w-3 mr-1" />
            Disabled
          </Badge>
        );
      },
    },
    {
      key: "raw_data",
      label: "Isolation",
      sortable: true,
      jsonbPath: "isolation.status",
      filterable: true,
      filterType: "select",
      filterOptions: [
        { label: "Isolated", value: "isolated" },
        { label: "Not Isolated", value: "notIsolated" },
      ],
      render: (_, row) => {
        const endpoint = row.raw_data as SophosPartnerEndpoint;
        const isIsolated = endpoint.isolation?.status === "isolated";
        return (
          <Badge
            variant={isIsolated ? "destructive" : "default"}
            className="text-xs"
          >
            {isIsolated ? (
              <>
                <Lock className="h-3 w-3 mr-1" />
                Isolated
              </>
            ) : (
              <>
                <LockOpen className="h-3 w-3 mr-1" />
                Normal
              </>
            )}
          </Badge>
        );
      },
    },
    {
      key: "raw_data",
      label: "Protection",
      sortable: false,
      render: (_, row) => {
        const endpoint = row.raw_data as SophosPartnerEndpoint;
        const protection = endpoint.packages?.protection;
        if (!protection) {
          return (
            <Badge variant="secondary" className="text-xs">
              None
            </Badge>
          );
        }

        return (
          <Badge
            variant={
              protection.status === "assigned" ? "default" : "destructive"
            }
            className="text-xs"
          >
            {protection.name || "Unknown"}
          </Badge>
        );
      },
    },
    {
      key: "raw_data",
      label: "Last Seen",
      sortable: true,
      jsonbPath: "lastSeenAt",
      render: (_, row) => {
        const endpoint = row.raw_data as SophosPartnerEndpoint;
        return (
          <div className="text-sm text-muted-foreground">
            {formatLastSeen(endpoint.lastSeenAt)}
          </div>
        );
      },
    },
    {
      key: "actions",
      label: "Actions",
      sortable: false,
      render: (_, row) => (
        <div className="flex gap-2">
          <Button variant="ghost" size="sm">
            <Eye className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm">
            <ExternalLink className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  // Predefined views for common Sophos scenarios
  const views: DataTableView[] = [
    {
      id: "all",
      name: "All Endpoints",
      filters: [],
    },
    {
      id: "tamper_disabled",
      name: "Tamper Protection Disabled",
      filters: [
        {
          column: "tamper_protection",
          operator: "eq",
          value: "false",
        },
      ],
    },
  ];

  // Actions for bulk operations
  const actions: DataTableAction<Tables<"entities">>[] = [
    {
      id: "enable_tamper",
      label: "Enable Tamper Protection",
      icon: <Shield className="h-4 w-4" />,
      disabled: (rows) => rows.length === 0,
      onClick: async (rows) => {
        console.log("Enable tamper protection for", rows.length, "devices");
        // Implementation would call Sophos API
      },
    },
    {
      id: "isolate",
      label: "Isolate Devices",
      icon: <Lock className="h-4 w-4" />,
      variant: "destructive",
      disabled: (rows) => rows.length === 0,
      onClick: async (rows) => {
        console.log("Isolate", rows.length, "devices");
        // Implementation would call Sophos API
      },
    },
    {
      id: "scan",
      label: "Run Scan",
      icon: <Activity className="h-4 w-4" />,
      disabled: (rows) => rows.length === 0,
      onClick: async (rows) => {
        console.log("Run scan on", rows.length, "devices");
        // Implementation would call Sophos API
      },
    },
  ];

  // Statistics component
  const { content: statsContent } = useLazyLoad({
    fetcher: async () => {
      const { data: entitiesResult } = await getRows("entities", {
        filters: [
          ["site_id", "eq", site.id],
          ["integration_id", "eq", "sophos-partner"],
          ["entity_type", "eq", "endpoint"],
        ],
      });

      const endpoints =
        entitiesResult?.rows?.map((e) => e.raw_data as SophosPartnerEndpoint) ||
        [];

      return {
        total: endpoints.length,
        online: endpoints.filter((e) => e.online).length,
        tamperDisabled: endpoints.filter(
          (e) => e.tamperProtectionSupported && !e.tamperProtectionEnabled
        ).length,
        healthIssues: endpoints.filter((e) => e.health?.overall === "bad")
          .length,
        isolated: endpoints.filter((e) => e.isolation?.status === "isolated")
          .length,
        threatIssues: endpoints.filter(
          (e) => e.health?.threats?.status === "bad"
        ).length,
        unprotected: endpoints.filter(
          (e) => e.packages?.protection?.status !== "assigned"
        ).length,
        mdrManaged: endpoints.filter((e) => e.mdrManaged).length,
      };
    },
    render: (stats) => {
      if (!stats) {
        return (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <div className="animate-pulse">
                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                    <div className="h-8 bg-gray-200 rounded w-1/2"></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        );
      }

      return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Endpoints
              </CardTitle>
              <Monitor className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">
                {stats.online} online • {stats.total - stats.online} offline
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Security Issues
              </CardTitle>
              <ShieldAlert className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {stats.tamperDisabled}
              </div>
              <p className="text-xs text-muted-foreground">
                Tamper protection disabled
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Health Problems
              </CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">
                {stats.healthIssues}
              </div>
              <p className="text-xs text-muted-foreground">
                {stats.threatIssues} threat issues
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Management</CardTitle>
              <Wrench className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {stats.mdrManaged}
              </div>
              <p className="text-xs text-muted-foreground">
                MDR managed endpoints
              </p>
            </CardContent>
          </Card>
        </div>
      );
    },
    skeleton: () => (
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-4 gap-4">
          <Skeleton className="rounded h-32" />
          <Skeleton className="rounded h-32" />
          <Skeleton className="rounded h-32" />
          <Skeleton className="rounded h-32" />
        </div>
      </div>
    ),
  });

  return (
    <div className="flex flex-col size-full gap-4">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-orange-600" />
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                Sophos Central Assets
              </h1>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Sync Sophos
          </Button>
        </div>
      </div>

      {/* Statistics */}
      {statsContent}

      {/* Data Table */}
      <DataTable
        columns={columns}
        fetcher={fetcher}
        views={views}
        actions={actions}
        initialSort={[{ column: "hostname", direction: "asc" }]}
        enableRefresh={true}
        enableColumnToggle={true}
        enableSelection={true}
        enableExport={true}
        useUrlState={true}
        searchableColumns={["raw_data"]}
        searchPlaceholder="Search by hostname..."
        emptyMessage="No Sophos endpoints found for this site"
        bodyHeight="max-h-[50vh]"
      />
    </div>
  );
}
