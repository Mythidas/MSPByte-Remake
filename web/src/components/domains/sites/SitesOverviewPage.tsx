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
  AlertTriangle,
  CheckCircle,
  Globe,
  Server,
  Key,
  DollarSign,
  Plug,
  Clock,
  TrendingUp,
  AlertCircle,
  Eye,
  ExternalLink,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tables } from "@workspace/shared/types/database";
import { useLazyLoad } from "@/lib/hooks/useLazyLoad";
import { getRows } from "@/lib/supabase/orm";
import { cn } from "@/lib/utils";
import { prettyText } from "@workspace/shared/lib/utils";

type Props = {
  site: Tables<"sites_view">;
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
function getEntityTypeConfig(entityType: string) {
  switch (entityType) {
    case "endpoint":
      return { icon: Monitor, label: "Assets", color: "blue" };
    case "user":
      return { icon: Users, label: "Users", color: "green" };
    case "license":
      return { icon: Key, label: "Licenses", color: "yellow" };
    case "ticket":
      return { icon: Ticket, label: "Tickets", color: "red" };
    case "contract":
      return { icon: FileText, label: "Contracts", color: "purple" };
    case "firewall":
      return { icon: Server, label: "Firewalls", color: "orange" };
    case "security_policy":
    case "policy":
    case "threat":
    case "conditional_access_policy":
    case "tenant_health":
      return { icon: Shield, label: "Security", color: "red" };
    case "billing":
    case "time_entry":
      return { icon: DollarSign, label: "Billing", color: "green" };
    case "monitoring_data":
    case "alert":
    case "patch":
    case "backup":
      return { icon: Activity, label: "Monitoring", color: "blue" };
    case "group":
      return { icon: Users, label: "Groups", color: "indigo" };
    case "company":
      return { icon: Building2, label: "Companies", color: "gray" };
    default:
      return { icon: Globe, label: entityType, color: "gray" };
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

// Helper function to get health status
function getHealthStatus(lastSync?: string, credentialExpiration?: string) {
  if (!lastSync) return { status: "error", label: "Never synced" };

  const now = new Date();
  const syncDate = new Date(lastSync);
  const expDate = credentialExpiration ? new Date(credentialExpiration) : null;

  // Check if credentials are expired
  if (expDate && expDate < now) {
    return { status: "error", label: "Credentials expired" };
  }

  // Check sync freshness
  const diffHours = (now.getTime() - syncDate.getTime()) / (1000 * 60 * 60);

  if (diffHours < 1) return { status: "success", label: "Healthy" };
  if (diffHours < 24) return { status: "warning", label: "Stale" };
  return { status: "error", label: "Outdated" };
}

export default function SiteOverviewPage({ site }: Props) {
  const [entities, setEntities] = useState<Tables<"entities">[]>([]);

  const entityStats = useMemo(() => {
    const stats = new Map<
      string,
      { count: number; integrations: Set<string> }
    >();

    entities.forEach((entity) => {
      const existing = stats.get(entity.entity_type) || {
        count: 0,
        integrations: new Set(),
      };
      existing.count++;
      existing.integrations.add(entity.integration_id);
      stats.set(entity.entity_type, existing);
    });

    return Array.from(stats.entries())
      .map(([entityType, data]) => {
        const config = getEntityTypeConfig(entityType);
        return {
          entityType,
          count: data.count,
          integrations: Array.from(data.integrations),
          ...config,
        };
      })
      .sort((a, b) => b.count - a.count);
  }, [entities]);

  const coverageAnalysis = useMemo(() => {
    // Find endpoints that exist in multiple systems
    const endpointSources = new Map<string, string[]>();

    entities
      .filter((e) => e.entity_type === "endpoint")
      .forEach((entity) => {
        // Use a normalized identifier - you might need to adjust this based on your data structure
        const normalized_data = entity.normalized_data as any;
        const identifier = normalized_data.name || entity.external_id;
        if (!endpointSources.has(identifier)) {
          endpointSources.set(identifier, []);
        }
        endpointSources.get(identifier)!.push(entity.integration_id);
      });

    const fullCoverage = Array.from(endpointSources.values()).filter(
      (sources) => sources.length >= 2
    ).length;
    const partialCoverage = Array.from(endpointSources.values()).filter(
      (sources) => sources.length === 1
    ).length;
    const totalEndpoints = endpointSources.size;

    return {
      totalEndpoints,
      fullCoverage,
      partialCoverage,
      coveragePercentage:
        totalEndpoints > 0
          ? Math.round((fullCoverage / totalEndpoints) * 100)
          : 0,
    };
  }, [entities]);

  const { content } = useLazyLoad({
    fetcher: async () => {
      // Fetch all data for the site overview
      const [{ data: dataSourcesResult }, { data: entitiesResult }] =
        await Promise.all([
          getRows("data_sources", {
            filters: [["site_id", "eq", site.id]],
          }),
          getRows("entities", {
            filters: [["site_id", "eq", site.id]],
            sorting: [
              ["entity_type", "asc"],
              ["updated_at", "desc"],
            ],
          }),
        ]);

      const dataSources = dataSourcesResult?.rows || [];
      const entities = entitiesResult?.rows || [];

      setEntities(entities);

      return {
        dataSources,
        totalEntities: entitiesResult?.total || 0,
      };
    },
    render: (data) => {
      if (!data) {
        return (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading site overview...</p>
            </div>
          </div>
        );
      }

      const { dataSources, totalEntities } = data;

      // Calculate integration health
      const integrationHealth = dataSources.map((ds) => {
        const meta =
          integrationMeta[ds.integration_id as keyof typeof integrationMeta];
        const health = getHealthStatus(
          ds.last_sync_at!,
          ds.credential_expiration_at
        );
        const entityCount = entities.filter(
          (e) => e.integration_id === ds.integration_id
        ).length;

        return {
          id: ds.integration_id,
          name: meta?.name || ds.integration_id,
          icon: meta?.icon || Globe,
          lastSync: ds.last_sync_at,
          health: health.status,
          healthLabel: health.label,
          entityCount,
          credentialExpiration: ds.credential_expiration_at,
        };
      });

      // Recent activity based on entity updates
      const recentActivity = entities.slice(0, 5).map((entity) => {
        const config = getEntityTypeConfig(entity.entity_type);
        const meta =
          integrationMeta[
            entity.integration_id as keyof typeof integrationMeta
          ];

        return {
          id: entity.id,
          type: config.label,
          name: (entity.normalized_data as any)?.name || entity.external_id,
          integration: meta?.name || entity.integration_id,
          updated: entity.updated_at,
          icon: config.icon,
        };
      });

      return (
        <div className="space-y-4">
          {/* Header */}
          <div className="flex justify-between items-start mb-6">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{site.name}</h1>
              <p className="text-muted-foreground mt-1">
                Site overview and health monitoring
              </p>
            </div>
            <Badge variant={site.status === "active" ? "default" : "secondary"}>
              {prettyText(site.status)}
            </Badge>
          </div>

          {/* Key Metrics */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Records
                </CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {totalEntities.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">
                  Across {dataSources.length} integration
                  {dataSources.length !== 1 ? "s" : ""}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Data Sources
                </CardTitle>
                <Plug className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{dataSources.length}</div>
                <p className="text-xs text-muted-foreground">
                  {
                    integrationHealth.filter((i) => i.health === "success")
                      .length
                  }{" "}
                  healthy
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Entity Types
                </CardTitle>
                <Globe className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{entityStats.length}</div>
                <p className="text-xs text-muted-foreground">
                  Different data categories
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Coverage</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {coverageAnalysis.coveragePercentage}%
                </div>
                <p className="text-xs text-muted-foreground">
                  Cross-platform monitoring
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Integration Health */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Integration Health
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {integrationHealth.length === 0 ? (
                  <div className="text-center py-4">
                    <AlertTriangle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">
                      No integrations configured
                    </p>
                  </div>
                ) : (
                  integrationHealth.map((integration) => (
                    <div
                      key={integration.id}
                      className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            "w-3 h-3 rounded-full",
                            integration.health === "success" && "bg-green-500",
                            integration.health === "warning" && "bg-yellow-500",
                            integration.health === "error" && "bg-red-500"
                          )}
                        />
                        <integration.icon className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">
                            {integration.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {integration.entityCount} records • Last sync:{" "}
                            {formatLastSync(integration.lastSync!)}
                          </p>
                        </div>
                      </div>
                      <Badge
                        variant={
                          integration.health === "success"
                            ? "default"
                            : integration.health === "warning"
                              ? "secondary"
                              : "destructive"
                        }
                        className="text-xs"
                      >
                        {integration.healthLabel}
                      </Badge>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Data Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Data Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {entityStats.length === 0 ? (
                  <div className="text-center py-4">
                    <Globe className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">
                      No data available
                    </p>
                  </div>
                ) : (
                  entityStats.slice(0, 6).map((stat) => (
                    <div
                      key={stat.entityType}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <stat.icon className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">{stat.label}</p>
                          <p className="text-xs text-muted-foreground">
                            {stat.integrations.length} integration
                            {stat.integrations.length !== 1 ? "s" : ""}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold">
                          {stat.count.toLocaleString()}
                        </p>
                        <Progress
                          value={(stat.count / totalEntities) * 100}
                          className="w-16 h-1 mt-1"
                        />
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          {/* Coverage Analysis & Recent Activity */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Coverage Analysis */}
            {coverageAnalysis.totalEndpoints > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    Asset Coverage Analysis
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <span className="text-sm font-medium">
                          Full Coverage
                        </span>
                      </div>
                      <span className="text-lg font-bold text-green-600">
                        {coverageAnalysis.fullCoverage}
                      </span>
                    </div>

                    <div className="flex justify-between items-center p-3 bg-yellow-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-yellow-600" />
                        <span className="text-sm font-medium">
                          Partial Coverage
                        </span>
                      </div>
                      <span className="text-lg font-bold text-yellow-600">
                        {coverageAnalysis.partialCoverage}
                      </span>
                    </div>

                    <div className="pt-2">
                      <div className="flex justify-between text-sm mb-1">
                        <span>Overall Coverage</span>
                        <span>{coverageAnalysis.coveragePercentage}%</span>
                      </div>
                      <Progress
                        value={coverageAnalysis.coveragePercentage}
                        className="h-2"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Recent Activity
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {recentActivity.length === 0 ? (
                  <div className="text-center py-4">
                    <Activity className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">
                      No recent activity
                    </p>
                  </div>
                ) : (
                  recentActivity.map((activity) => (
                    <div
                      key={activity.id}
                      className="flex items-center justify-between p-2 hover:bg-muted/50 rounded-lg transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <activity.icon className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">{activity.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {activity.type} • {activity.integration}
                          </p>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatLastSync(activity.updated)}
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="flex gap-4">
              <Button variant="outline" size="sm">
                <Eye className="h-4 w-4 mr-2" />
                View All Assets
              </Button>
              <Button variant="outline" size="sm">
                <Activity className="h-4 w-4 mr-2" />
                Check Health
              </Button>
              <Button variant="outline" size="sm">
                <ExternalLink className="h-4 w-4 mr-2" />
                Sync Data
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    },
  });

  return content;
}
