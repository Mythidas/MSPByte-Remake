import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, Link2, Unlink } from "lucide-react";
import { useState, useMemo } from "react";
import { useLazyLoad } from "@/lib/hooks/useLazyLoad";
import { getRows } from "@/lib/supabase/orm";
import { Tables } from "@workspace/shared/types/database";
import { ScrollArea } from "@/components/ui/scroll-area";
import Microsoft365ConnectDialog from "@/modules/integrations/microsoft-365/components/Microsoft365ConnectDialog";

type Props = {
  integration: Tables<"integrations">;
};

type SiteMapping = {
  siteId: string;
  siteName: string;
  dataSource?: Tables<"data_sources">;
  isConnected: boolean;
  needsReConsent: boolean;
  lastSyncAt?: string;
  tenantName?: string;
  connectionStatus: "connected" | "needs_consent" | "not_connected" | "error";
};

export default function Microsoft365MappingTab({ integration }: Props) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<
    "all" | "connected" | "needs_consent" | "not_connected"
  >("all");

  const [data, setData] = useState<
    | {
        sites: Tables<"sites_view">[];
        dataSources: Tables<"data_sources">[];
      }
    | undefined
  >(undefined);

  // Memoize filtered data
  const filteredData = useMemo(() => {
    if (!data) return [];

    const { sites, dataSources } = data;
    const currentRevision =
      (integration.config_schema as any)?.consent_version || 0;

    // Create site mappings with connection status
    const siteMappings: SiteMapping[] = sites.map((site) => {
      const dataSource = dataSources.find((ds) => ds.site_id === site.id);

      let connectionStatus: SiteMapping["connectionStatus"] = "not_connected";
      let needsReConsent = false;

      if (dataSource) {
        const permissionVersion =
          (dataSource.config as any)?.consent_version || 0;
        needsReConsent = permissionVersion < currentRevision;

        if (dataSource.status === "error") {
          connectionStatus = "error";
        } else if (needsReConsent) {
          connectionStatus = "needs_consent";
        } else {
          connectionStatus = "connected";
        }
      }

      return {
        siteId: site.id!,
        siteName: site.name!,
        dataSource,
        isConnected: !!dataSource && dataSource.status !== "error",
        needsReConsent,
        lastSyncAt: dataSource?.last_sync_at!,
        tenantName: (dataSource?.config as any)?.tenant_name,
        connectionStatus,
      };
    });

    // Apply filters
    let filtered = siteMappings;

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(
        (mapping) =>
          mapping.siteName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (mapping.tenantName &&
            mapping.tenantName.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    // Filter by connection status
    if (filterStatus !== "all") {
      filtered = filtered.filter(
        (mapping) => mapping.connectionStatus === filterStatus
      );
    }

    return filtered;
  }, [data, searchTerm, filterStatus, integration.config_schema]);

  // Calculate stats based on all data
  const stats = useMemo(() => {
    if (!data)
      return {
        totalSites: 0,
        connectedSites: 0,
        needsConsentSites: 0,
        errorSites: 0,
      };

    const { sites, dataSources } = data;
    const currentRevision =
      (integration.config_schema as any)?.consent_version || 1;

    let connectedSites = 0;
    let needsConsentSites = 0;
    let errorSites = 0;

    sites.forEach((site) => {
      const dataSource = dataSources.find((ds) => ds.site_id === site.id);
      if (dataSource) {
        if (dataSource.status === "error") {
          errorSites++;
        } else if (
          ((dataSource.config as any)?.consent_version || 0) < currentRevision
        ) {
          needsConsentSites++;
        } else {
          connectedSites++;
        }
      }
    });

    return {
      totalSites: sites.length,
      connectedSites,
      needsConsentSites,
      errorSites,
    };
  }, [data, integration.config_schema]);

  const { content } = useLazyLoad({
    fetcher: async () => {
      const sites = await getRows("sites_view");
      const dataSources = await getRows("data_sources", {
        filters: [
          ["integration_id", "eq", integration.id],
          ["site_id", "not.is", null],
        ],
      });

      const fetchedData = {
        sites: sites.data ? sites.data.rows : [],
        dataSources: dataSources.data ? dataSources.data.rows : [],
      };

      setData(fetchedData);
      return fetchedData;
    },
    render: (data) => {
      if (!data) return <strong>Failed to fetch data. Please refresh</strong>;

      const { sites } = data;

      const getStatusBadge = (mapping: SiteMapping) => {
        switch (mapping.connectionStatus) {
          case "connected":
            return (
              <Badge className="bg-green-100 text-green-800 border-green-200">
                Connected
              </Badge>
            );
          case "needs_consent":
            return (
              <Badge className="bg-orange-100 text-orange-800 border-orange-200">
                Needs Update
              </Badge>
            );
          case "error":
            return (
              <Badge className="bg-red-100 text-red-800 border-red-200">
                Error
              </Badge>
            );
          default:
            return <Badge variant="outline">Not Connected</Badge>;
        }
      };

      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium">
                Microsoft 365 Site Connections
              </h3>
              <p className="text-sm text-muted-foreground">
                Connect sites to Microsoft 365 tenants for data synchronization
              </p>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search sites or tenant names..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select
              value={filterStatus}
              onValueChange={(value: typeof filterStatus) =>
                setFilterStatus(value)
              }
            >
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sites</SelectItem>
                <SelectItem value="connected">Connected</SelectItem>
                <SelectItem value="needs_consent">Needs Update</SelectItem>
                <SelectItem value="not_connected">Not Connected</SelectItem>
                <SelectItem value="error">Error</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Stats */}
          <div className="text-sm text-muted-foreground">
            {stats.totalSites} total sites • {stats.connectedSites} connected •{" "}
            {stats.needsConsentSites} need updates
            {stats.errorSites > 0 && ` • ${stats.errorSites} errors`}
          </div>

          {/* Sites List */}
          <ScrollArea className="max-h-96">
            <div className="grid gap-2">
              {filteredData.length === 0 ? (
                <Card>
                  <CardContent className="flex items-center justify-center py-8">
                    <div className="text-center">
                      <p className="text-muted-foreground">
                        No sites found matching your filters
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        onClick={() => {
                          setSearchTerm("");
                          setFilterStatus("all");
                        }}
                      >
                        Clear Filters
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                filteredData.map((mapping) => {
                  const site = sites.find((s) => s.id === mapping.siteId)!;

                  return (
                    <Card
                      key={mapping.siteId}
                      className={
                        mapping.needsReConsent ? "border-orange-200" : ""
                      }
                    >
                      <CardContent>
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3">
                              <h4 className="font-medium">
                                {mapping.siteName}
                              </h4>
                              {getStatusBadge(mapping)}
                            </div>

                            {mapping.isConnected ? (
                              <div className="mt-2 space-y-1">
                                {mapping.tenantName && (
                                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Link2 className="w-4 h-4" />
                                    <span>Tenant: {mapping.tenantName}</span>
                                  </div>
                                )}
                                {mapping.lastSyncAt && (
                                  <div className="text-xs text-muted-foreground">
                                    Last synced:{" "}
                                    {new Date(
                                      mapping.lastSyncAt
                                    ).toLocaleDateString()}
                                  </div>
                                )}
                                {mapping.dataSource?.status === "error" && (
                                  <div className="text-xs text-red-600">
                                    Connection error - check credentials and
                                    permissions
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Unlink className="w-4 h-4" />
                                <span>
                                  Not connected to any Microsoft 365 tenant
                                </span>
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            <Microsoft365ConnectDialog
                              site={site}
                              dataSource={mapping.dataSource}
                              integration={integration}
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </div>
      );
    },
  });

  return content;
}
