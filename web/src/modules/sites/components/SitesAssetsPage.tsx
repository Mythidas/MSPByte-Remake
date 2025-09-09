"use client";

import {
  Monitor,
  Shield,
  AlertTriangle,
  CheckCircle,
  Download,
  RefreshCw,
  Eye,
  ExternalLink,
  Wifi,
  WifiOff,
  Server,
  Laptop,
  Smartphone,
  HardDrive,
  TrendingUp,
  AlertCircle,
  Zap,
} from "lucide-react";
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tables } from "@workspace/shared/types/database";
import { useLazyLoad } from "@/lib/hooks/useLazyLoad";
import { getRows } from "@/lib/supabase/orm";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Props = {
  site: Tables<"sites_view">;
};

// Integration metadata
const integrationMeta = {
  "sophos-central": {
    name: "Sophos Central",
    icon: Shield,
    color: "orange",
    assetFields: {
      tamperProtection: "tamper_protection_enabled",
      antivirusStatus: "antivirus_status",
      lastSeen: "last_seen_at",
      threats: "threat_count",
      isolation: "isolation_status",
    },
  },
  "datto-rmm": {
    name: "Datto RMM",
    icon: Monitor,
    color: "blue",
    assetFields: {
      online: "online_status",
      lastContact: "last_contact",
      monitoring: "monitoring_enabled",
      patches: "patch_status",
      backup: "backup_status",
    },
  },
  "cove-backup": {
    name: "Cove Backup",
    icon: HardDrive,
    color: "green",
    assetFields: {
      backupStatus: "backup_status",
      lastBackup: "last_backup",
      dataSize: "backup_size",
      retention: "retention_days",
    },
  },
} as const;

// Asset type configuration
function getAssetTypeConfig(assetType: string) {
  switch (assetType?.toLowerCase()) {
    case "server":
      return { icon: Server, label: "Server", priority: 1 };
    case "workstation":
    case "desktop":
      return { icon: Monitor, label: "Workstation", priority: 2 };
    case "laptop":
      return { icon: Laptop, label: "Laptop", priority: 3 };
    case "mobile":
    case "smartphone":
      return { icon: Smartphone, label: "Mobile", priority: 4 };
    default:
      return { icon: Monitor, label: "Unknown", priority: 5 };
  }
}

// Helper function to format last seen time
function formatLastSeen(lastSeen?: string): string {
  if (!lastSeen) return "Never";
  const date = new Date(lastSeen);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
  return `${Math.floor(diffMins / 1440)}d ago`;
}

// Asset data aggregation
function aggregateAssetData(entities: Tables<"entities">[]) {
  const assetMap = new Map<string, any>();

  entities.forEach((entity) => {
    if (entity.entity_type !== "endpoint") return;

    const normalizedData = entity.normalized_data as any;
    const assetKey =
      normalizedData?.name || normalizedData?.hostname || entity.external_id;

    if (!assetMap.has(assetKey)) {
      assetMap.set(assetKey, {
        name: assetKey,
        sources: new Map(),
        primaryType: normalizedData?.type || "unknown",
        os: normalizedData?.operating_system || "Unknown",
        lastActivity: entity.updated_at,
      });
    }

    const asset = assetMap.get(assetKey);
    asset.sources.set(entity.integration_id, {
      entityId: entity.id,
      externalId: entity.external_id,
      data: normalizedData,
      lastSync: entity.updated_at,
      integration: entity.integration_id,
    });

    // Update last activity if this source is newer
    if (new Date(entity.updated_at) > new Date(asset.lastActivity)) {
      asset.lastActivity = entity.updated_at;
    }
  });

  return Array.from(assetMap.values());
}

export default function SiteAssetsPage({ site }: Props) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIntegration, setSelectedIntegration] = useState("all");
  const [selectedIssueFilter, setSelectedIssueFilter] = useState("all");
  const [selectedAssetType, setSelectedAssetType] = useState("all");
  const [activeView, setActiveView] = useState("unified");
  const [aggregatedAssets, setAggregatedAssets] = useState<any[]>([]);

  const filteredAssets = useMemo(() => {
    return aggregatedAssets.filter((asset) => {
      // Search filter
      const matchesSearch =
        asset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        asset.os.toLowerCase().includes(searchTerm.toLowerCase());

      // Integration filter
      const matchesIntegration =
        selectedIntegration === "all" || asset.sources.has(selectedIntegration);

      // Asset type filter
      const matchesAssetType =
        selectedAssetType === "all" ||
        asset.primaryType.toLowerCase() === selectedAssetType.toLowerCase();

      // Issue filter
      let matchesIssueFilter = true;
      if (selectedIssueFilter !== "all") {
        switch (selectedIssueFilter) {
          case "tamper_disabled":
            const sophosData = asset.sources.get("sophos-central")?.data;
            matchesIssueFilter =
              sophosData && !sophosData.tamper_protection_enabled;
            break;
          case "av_upgradeable":
            const avData = asset.sources.get("sophos-central")?.data;
            matchesIssueFilter =
              avData && avData.antivirus_status === "upgradeable";
            break;
          case "offline":
            matchesIssueFilter = Array.from(asset.sources.values()).some(
              (source: any) =>
                source.data.online_status === false ||
                source.data.status === "offline"
            );
            break;
          case "missing_coverage":
            matchesIssueFilter = asset.sources.size === 1;
            break;
          default:
            matchesIssueFilter = true;
        }
      }

      return (
        matchesSearch &&
        matchesIntegration &&
        matchesAssetType &&
        matchesIssueFilter
      );
    });
  }, [
    aggregatedAssets,
    searchTerm,
    selectedIntegration,
    selectedAssetType,
    selectedIssueFilter,
  ]);

  // Calculate statistics
  const stats = useMemo(() => {
    const total = aggregatedAssets.length;
    const fullCoverage = aggregatedAssets.filter(
      (a) => a.sources.size >= 2
    ).length;
    const sophosAssets = aggregatedAssets.filter((a) =>
      a.sources.has("sophos-central")
    );
    const tamperDisabled = sophosAssets.filter(
      (a) => !a.sources.get("sophos-central")?.data?.tamper_protection_enabled
    ).length;
    const avUpgradeable = sophosAssets.filter(
      (a) =>
        a.sources.get("sophos-central")?.data?.antivirus_status ===
        "upgradeable"
    ).length;
    const offline = aggregatedAssets.filter((a) =>
      Array.from(a.sources.values()).some(
        (source: any) =>
          source.data.online_status === false ||
          source.data.status === "offline"
      )
    ).length;

    return {
      total,
      fullCoverage,
      tamperDisabled,
      avUpgradeable,
      offline,
      coveragePercentage:
        total > 0 ? Math.round((fullCoverage / total) * 100) : 0,
    };
  }, [aggregatedAssets]);

  const { content } = useLazyLoad({
    fetcher: async () => {
      // Fetch endpoint entities for this site
      const { data: entitiesResult } = await getRows("entities", {
        filters: [
          ["site_id", "eq", site.id],
          ["entity_type", "eq", "endpoint"],
        ],
        sorting: [["updated_at", "desc"]],
      });

      // Fetch data sources to know which integrations are available
      const { data: dataSourcesResult } = await getRows("data_sources", {
        filters: [["site_id", "eq", site.id]],
      });

      const entities = entitiesResult?.rows || [];
      const dataSources = dataSourcesResult?.rows || [];
      setAggregatedAssets(aggregateAssetData(entities));

      return {
        entities,
        dataSources,
        totalAssets: entitiesResult?.total || 0,
      };
    },
    render: (data) => {
      if (!data) {
        return (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading assets...</p>
            </div>
          </div>
        );
      }

      const { entities, dataSources } = data;

      // Get available integrations that have endpoint data
      const availableIntegrations = dataSources
        .filter((ds) =>
          entities.some((e) => e.integration_id === ds.integration_id)
        )
        .map((ds) => ds.integration_id);

      // Aggregate asset data from multiple sources

      const renderUnifiedView = () => (
        <div className="space-y-4">
          <div className="border rounded-lg overflow-hidden">
            {/* Table Header */}
            <div className="grid grid-cols-7 gap-4 p-4 bg-muted/50 border-b font-medium text-sm">
              <div>Asset Name</div>
              <div>Type</div>
              <div>Sources</div>
              <div>Status</div>
              <div>Issues</div>
              <div>Last Activity</div>
              <div>Actions</div>
            </div>

            {/* Table Body */}
            <div className="divide-y">
              {filteredAssets.map((asset, index) => {
                const typeConfig = getAssetTypeConfig(asset.primaryType);
                const TypeIcon = typeConfig.icon;

                // Determine overall status
                const isOnline = Array.from(asset.sources.values()).some(
                  (source: any) =>
                    source.data.online_status === true ||
                    source.data.status === "online"
                );

                // Collect issues
                const issues = [];
                const sophosData = asset.sources.get("sophos-central")?.data;
                if (sophosData) {
                  if (!sophosData.tamper_protection_enabled)
                    issues.push("Tamper Protection Disabled");
                  if (sophosData.antivirus_status === "upgradeable")
                    issues.push("AV Upgradeable");
                  if (sophosData.threat_count > 0)
                    issues.push(`${sophosData.threat_count} Threats`);
                }
                if (asset.sources.size === 1) issues.push("Limited Coverage");

                return (
                  <div
                    key={index}
                    className="grid grid-cols-7 gap-4 p-4 hover:bg-muted/30 transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-3">
                        <TypeIcon className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{asset.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {asset.os}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div>
                      <Badge variant="outline">{typeConfig.label}</Badge>
                    </div>
                    <div>
                      <div className="flex gap-1 flex-wrap">
                        {Array.from(asset.sources.keys()).map(
                          (integrationId, idx) => {
                            const meta =
                              integrationMeta[
                                integrationId as keyof typeof integrationMeta
                              ];
                            if (!meta) return null;
                            const Icon = meta.icon;
                            return (
                              <Badge
                                key={idx}
                                variant="secondary"
                                className="text-xs"
                              >
                                <Icon className="h-3 w-3 mr-1" />
                                {meta.name}
                              </Badge>
                            );
                          }
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        {isOnline ? (
                          <Wifi className="h-4 w-4 text-green-500" />
                        ) : (
                          <WifiOff className="h-4 w-4 text-red-500" />
                        )}
                        <span
                          className={cn(
                            "text-sm",
                            isOnline ? "text-green-600" : "text-red-600"
                          )}
                        >
                          {isOnline ? "Online" : "Offline"}
                        </span>
                      </div>
                    </div>
                    <div>
                      {issues.length > 0 ? (
                        <div className="space-y-1">
                          {issues.slice(0, 2).map((issue, idx) => (
                            <Badge
                              key={idx}
                              variant="destructive"
                              className="text-xs mr-1"
                            >
                              {issue}
                            </Badge>
                          ))}
                          {issues.length > 2 && (
                            <Badge variant="outline" className="text-xs">
                              +{issues.length - 2} more
                            </Badge>
                          )}
                        </div>
                      ) : (
                        <Badge variant="default" className="text-xs">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Healthy
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {formatLastSeen(asset.lastActivity)}
                    </div>
                    <div>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      );

      const renderSourceSpecificView = (integrationId: string) => {
        const assetsFromSource = aggregatedAssets.filter((a) =>
          a.sources.has(integrationId)
        );
        const meta =
          integrationMeta[integrationId as keyof typeof integrationMeta];

        if (!meta) return <div>Integration not supported</div>;

        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <meta.icon className="h-5 w-5" />
              <h3 className="text-lg font-semibold">
                {meta.name} Specific View
              </h3>
              <Badge variant="outline">{assetsFromSource.length} assets</Badge>
            </div>

            <div className="border rounded-lg overflow-hidden">
              {/* Dynamic headers based on integration */}
              <div
                className={cn(
                  "grid gap-4 p-4 bg-muted/50 border-b font-medium text-sm",
                  integrationId === "sophos-central"
                    ? "grid-cols-8"
                    : "grid-cols-7"
                )}
              >
                <div>Asset Name</div>
                <div>Type</div>
                {integrationId === "sophos-central" && (
                  <>
                    <div>Tamper Protection</div>
                    <div>Antivirus Status</div>
                    <div>Threats</div>
                    <div>Isolation</div>
                  </>
                )}
                {integrationId === "datto-rmm" && (
                  <>
                    <div>Online Status</div>
                    <div>Monitoring</div>
                    <div>Patches</div>
                    <div>Backup</div>
                  </>
                )}
                <div>Last Seen</div>
                <div>Actions</div>
              </div>

              {/* Table Body */}
              <div className="divide-y">
                {assetsFromSource.map((asset, index) => {
                  const sourceData = asset.sources.get(integrationId);
                  const data = sourceData?.data;
                  const typeConfig = getAssetTypeConfig(asset.primaryType);
                  const TypeIcon = typeConfig.icon;

                  return (
                    <div
                      key={index}
                      className={cn(
                        "grid gap-4 p-4 hover:bg-muted/30 transition-colors",
                        integrationId === "sophos-central"
                          ? "grid-cols-8"
                          : "grid-cols-7"
                      )}
                    >
                      <div>
                        <div className="flex items-center gap-3">
                          <TypeIcon className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="font-medium">{asset.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {asset.os}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div>
                        <Badge variant="outline">{typeConfig.label}</Badge>
                      </div>

                      {integrationId === "sophos-central" && (
                        <>
                          <div>
                            {data?.tamper_protection_enabled ? (
                              <Badge variant="default" className="text-xs">
                                <Shield className="h-3 w-3 mr-1" />
                                Enabled
                              </Badge>
                            ) : (
                              <Badge variant="destructive" className="text-xs">
                                <AlertTriangle className="h-3 w-3 mr-1" />
                                Disabled
                              </Badge>
                            )}
                          </div>
                          <div>
                            <Badge
                              variant={
                                data?.antivirus_status === "up_to_date"
                                  ? "default"
                                  : "destructive"
                              }
                              className="text-xs"
                            >
                              {data?.antivirus_status || "Unknown"}
                            </Badge>
                          </div>
                          <div>
                            {data?.threat_count > 0 ? (
                              <Badge variant="destructive" className="text-xs">
                                <AlertCircle className="h-3 w-3 mr-1" />
                                {data.threat_count}
                              </Badge>
                            ) : (
                              <Badge variant="default" className="text-xs">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Clean
                              </Badge>
                            )}
                          </div>
                          <div>
                            <Badge
                              variant={
                                data?.isolation_status === "isolated"
                                  ? "destructive"
                                  : "default"
                              }
                              className="text-xs"
                            >
                              {data?.isolation_status || "Normal"}
                            </Badge>
                          </div>
                        </>
                      )}

                      {integrationId === "datto-rmm" && (
                        <>
                          <div>
                            {data?.online_status ? (
                              <Badge variant="default" className="text-xs">
                                <Wifi className="h-3 w-3 mr-1" />
                                Online
                              </Badge>
                            ) : (
                              <Badge variant="destructive" className="text-xs">
                                <WifiOff className="h-3 w-3 mr-1" />
                                Offline
                              </Badge>
                            )}
                          </div>
                          <div>
                            <Badge
                              variant={
                                data?.monitoring_enabled
                                  ? "default"
                                  : "secondary"
                              }
                              className="text-xs"
                            >
                              {data?.monitoring_enabled ? "Active" : "Inactive"}
                            </Badge>
                          </div>
                          <div>
                            <Badge
                              variant={
                                data?.patch_status === "up_to_date"
                                  ? "default"
                                  : "destructive"
                              }
                              className="text-xs"
                            >
                              {data?.patch_status || "Unknown"}
                            </Badge>
                          </div>
                          <div>
                            <Badge
                              variant={
                                data?.backup_status === "success"
                                  ? "default"
                                  : "destructive"
                              }
                              className="text-xs"
                            >
                              {data?.backup_status || "Unknown"}
                            </Badge>
                          </div>
                        </>
                      )}

                      <div className="text-sm text-muted-foreground">
                        {formatLastSeen(
                          data?.last_seen_at || sourceData?.lastSync
                        )}
                      </div>
                      <div>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm">
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      };

      return (
        <div className="space-y-6">
          {/* Header */}
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Assets</h1>
              <p className="text-muted-foreground mt-1">
                Manage and monitor endpoints across all integrations
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              <Button size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Sync All
              </Button>
            </div>
          </div>

          {/* Statistics Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Assets
                </CardTitle>
                <Monitor className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.total}</div>
                <p className="text-xs text-muted-foreground">
                  Across all sources
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
                  {stats.coveragePercentage}%
                </div>
                <p className="text-xs text-muted-foreground">
                  {stats.fullCoverage} multi-source
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Tamper Issues
                </CardTitle>
                <Shield className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {stats.tamperDisabled}
                </div>
                <p className="text-xs text-muted-foreground">
                  Protection disabled
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  AV Updates
                </CardTitle>
                <Zap className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-600">
                  {stats.avUpgradeable}
                </div>
                <p className="text-xs text-muted-foreground">Need updates</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Offline</CardTitle>
                <WifiOff className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {stats.offline}
                </div>
                <p className="text-xs text-muted-foreground">Not responding</p>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-64">
              <Input
                placeholder="Search assets..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full"
              />
            </div>

            <Select
              value={selectedIntegration}
              onValueChange={setSelectedIntegration}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All Sources" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                {availableIntegrations.map((integration) => {
                  const meta =
                    integrationMeta[
                      integration as keyof typeof integrationMeta
                    ];
                  return (
                    <SelectItem key={integration} value={integration}>
                      {meta?.name || integration}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>

            <Select
              value={selectedAssetType}
              onValueChange={setSelectedAssetType}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="server">Servers</SelectItem>
                <SelectItem value="workstation">Workstations</SelectItem>
                <SelectItem value="laptop">Laptops</SelectItem>
                <SelectItem value="mobile">Mobile</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={selectedIssueFilter}
              onValueChange={setSelectedIssueFilter}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All Issues" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Assets</SelectItem>
                <SelectItem value="tamper_disabled">
                  Tamper Protection Disabled
                </SelectItem>
                <SelectItem value="av_upgradeable">AV Upgradeable</SelectItem>
                <SelectItem value="offline">Offline Assets</SelectItem>
                <SelectItem value="missing_coverage">
                  Limited Coverage
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Main Content */}
          <Tabs value={activeView} onValueChange={setActiveView}>
            <TabsList>
              <TabsTrigger value="unified">Unified View</TabsTrigger>
              {availableIntegrations.map((integration) => {
                const meta =
                  integrationMeta[integration as keyof typeof integrationMeta];
                return (
                  <TabsTrigger key={integration} value={integration}>
                    {meta?.name || integration}
                  </TabsTrigger>
                );
              })}
            </TabsList>

            <TabsContent value="unified" className="mt-6">
              {renderUnifiedView()}
            </TabsContent>

            {availableIntegrations.map((integration) => (
              <TabsContent
                key={integration}
                value={integration}
                className="mt-6"
              >
                {renderSourceSpecificView(integration)}
              </TabsContent>
            ))}
          </Tabs>

          {filteredAssets.length === 0 && (
            <div className="text-center py-12">
              <Monitor className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No assets found</h3>
              <p className="text-muted-foreground">
                {searchTerm ||
                selectedIntegration !== "all" ||
                selectedIssueFilter !== "all"
                  ? "Try adjusting your filters"
                  : "No assets have been synced yet"}
              </p>
            </div>
          )}
        </div>
      );
    },
  });

  return content;
}
