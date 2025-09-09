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
import { Search, Link2, Unlink, Save, X } from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { useLazyLoad } from "@/lib/hooks/useLazyLoad";
import { deleteRows, getRows, insertRows, updateRow } from "@/lib/supabase/orm";
import { Tables, TablesInsert } from "@workspace/shared/types/database";
import { SophosPartnerConfig } from "@workspace/shared/types/source/sophos-partner";
import { SophosPartnerTenant } from "@workspace/shared/types/source/sophos-partner/tenants";
import { getSophosPartnerTenants } from "@/lib/actions/sophos-partner";
import SearchBox from "@/components/SearchBox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { SubmitButton } from "@/components/SubmitButton";

type Props = {
  integration: Tables<"integrations">;
  dataSource: Tables<"data_sources">;
};

type SiteMapping = {
  siteId: string;
  siteName: string;
  sophosId?: string;
  sophosName?: string;
  isMapped: boolean;
};

export default function SophosPartnerMappingTab({
  integration,
  dataSource,
}: Props) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<
    "all" | "mapped" | "unmapped"
  >("all");
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [pendingChanges, setPendingChanges] = useState<Record<string, string>>(
    {}
  );
  const [data, setData] = useState<
    | {
        sites: Tables<"sites_view">[];
        sophosSites: SophosPartnerTenant[];
        dataSources: Tables<"data_sources">[];
      }
    | undefined
  >(undefined);
  const [isSaving, setIsSaving] = useState(false);

  // Initialize mappings from existing data sources
  useEffect(() => {
    if (data?.dataSources) {
      const existingMappings: Record<string, string> = {};
      data.dataSources.forEach((ds) => {
        if (ds.site_id && ds.external_id) {
          existingMappings[ds.site_id] = ds.external_id;
        }
      });
      setMappings(existingMappings);
    }
  }, [data?.dataSources]);

  // Memoize filtered data outside of render function
  const filteredData = useMemo(() => {
    if (!data) return [];

    const { sites, sophosSites } = data;

    // Create site mappings with current state
    const siteMappings: SiteMapping[] = sites.map((site) => {
      const mappedSophosId = mappings[site.id!] || pendingChanges[site.id!];
      const mappedSophos = mappedSophosId
        ? sophosSites.find((s: SophosPartnerTenant) => s.id === mappedSophosId)
        : null;

      return {
        siteId: site.id!,
        siteName: site.name!,
        sophosId: mappedSophos?.id,
        sophosName: mappedSophos?.name,
        isMapped: !!mappedSophos,
      };
    });

    // Apply filters
    let filtered = siteMappings;

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(
        (mapping) =>
          mapping.siteName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (mapping.sophosName &&
            mapping.sophosName.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    // Filter by mapping status
    if (filterStatus !== "all") {
      filtered = filtered.filter((mapping) =>
        filterStatus === "mapped" ? mapping.isMapped : !mapping.isMapped
      );
    }

    return filtered;
  }, [data, searchTerm, filterStatus, mappings, pendingChanges]);

  // Calculate stats based on all data, not just filtered data
  const stats = useMemo(() => {
    if (!data) return { totalSites: 0, mappedSites: 0, availableTenants: 0 };

    const { sites, sophosSites } = data;
    const allMappings = sites.map((site) => {
      const mappedSophosId = mappings[site.id!] || pendingChanges[site.id!];
      return !!mappedSophosId;
    });

    return {
      totalSites: sites.length,
      mappedSites: allMappings.filter(Boolean).length,
      availableTenants: sophosSites.length,
    };
  }, [data, mappings, pendingChanges]);

  const { content } = useLazyLoad({
    fetcher: async () => {
      const sites = await getRows("sites_view");
      const sophosSites = await getSophosPartnerTenants({
        config: dataSource.config as SophosPartnerConfig,
      });
      const dataSources = await getRows("data_sources", {
        filters: [
          ["integration_id", "eq", integration.id],
          ["site_id", "not.is", null],
        ],
      });

      const fetchedData = {
        sites: sites.data ? sites.data.rows : [],
        sophosSites: sophosSites.data ? sophosSites.data : [],
        dataSources: dataSources.data ? dataSources.data.rows : [],
      };

      setData(fetchedData);
      return fetchedData;
    },
    render: (data) => {
      if (!data) return <strong>Failed to fetch data. Please refresh</strong>;

      const { sites, sophosSites, dataSources } = data;
      const hasPendingChanges = Object.keys(pendingChanges).length > 0;

      const handleMappingChange = (siteId: string, sophosId: string | null) => {
        setPendingChanges((prev) => {
          const updated = { ...prev };
          if (sophosId) {
            updated[siteId] = sophosId;
          } else {
            delete updated[siteId];
          }
          return updated;
        });
      };

      const handleSaveMappings = async () => {
        setIsSaving(true);

        try {
          const toCreate: TablesInsert<"data_sources">[] = [];
          const toUpdate: {
            id: string;
            external_id: string;
          }[] = [];

          const toDelete: string[] = [];

          Object.entries(pendingChanges).forEach(([siteId, newSophosId]) => {
            const existingDataSource = dataSources.find(
              (ds) => ds.site_id === siteId
            );

            if (newSophosId !== "-") {
              if (existingDataSource) {
                toUpdate.push({
                  id: existingDataSource.id,
                  external_id: newSophosId,
                });
              } else {
                const sophosSite = sophosSites.find(
                  (s) => s.id === newSophosId
                );
                toCreate.push({
                  site_id: siteId,
                  external_id: newSophosId,
                  integration_id: integration.id,
                  tenant_id: dataSource.tenant_id,
                  config: { api_host: sophosSite?.apiHost },
                  credential_expiration_at: dataSource.credential_expiration_at,
                });
              }
            } else {
              if (existingDataSource) {
                toDelete.push(existingDataSource.id);
              }
            }
          });

          console.log(toCreate);

          {
            const { error } = await insertRows("data_sources", {
              rows: toCreate,
            });
            if (error) {
              console.log(error.message);
            }
          }
          await Promise.all(
            toUpdate.map((item) =>
              updateRow("data_sources", {
                id: item.id,
                row: { external_id: item.external_id },
              })
            )
          );
          await deleteRows("data_sources", {
            filters: [["id", "in", toDelete]],
          });

          setMappings((prev) => ({ ...prev, ...pendingChanges }));
          setPendingChanges({});
          toast.info(
            `Mappings updated: ${toCreate.length + toUpdate.length + toDelete.length}`
          );
        } catch (error) {
          toast.error(`Failed to save mappings: ${error}`);
        } finally {
          setIsSaving(false);
        }
      };

      const handleDiscardChanges = () => {
        setPendingChanges({});
      };

      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium">Site Mappings</h3>
              <p className="text-sm text-muted-foreground">
                Map your sites to Sophos tenants for data synchronization
              </p>
            </div>
            {hasPendingChanges && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDiscardChanges}
                >
                  <X className="w-4 h-4 mr-1" />
                  Discard
                </Button>
                <SubmitButton
                  size="sm"
                  onClick={handleSaveMappings}
                  pending={isSaving}
                >
                  <Save className="w-4 h-4 mr-1" />
                  Save Changes{" "}
                  {hasPendingChanges &&
                    `(${Object.keys(pendingChanges).length})`}
                </SubmitButton>
              </div>
            )}
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search sites or Sophos tenants..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select
              value={filterStatus}
              onValueChange={(value: "all" | "mapped" | "unmapped") =>
                setFilterStatus(value)
              }
            >
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sites</SelectItem>
                <SelectItem value="mapped">Mapped Only</SelectItem>
                <SelectItem value="unmapped">Unmapped Only</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Stats */}
          <div className="text-sm text-muted-foreground">
            {stats.totalSites} sites • {stats.totalSites - stats.mappedSites}{" "}
            available for mapping [{stats.availableTenants} Sophos Tenants]
          </div>

          {/* Mappings List */}
          <ScrollArea className="max-h-96">
            <div className="grid gap-2">
              {filteredData.length === 0 ? (
                <Card>
                  <CardContent className="flex items-center justify-center">
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
                  const isPending = mapping.siteId in pendingChanges;
                  const currentSophosId =
                    pendingChanges[mapping.siteId] || mapping.sophosId;
                  const currentSophos = currentSophosId
                    ? sophosSites.find(
                        (s: SophosPartnerTenant) => s.id === currentSophosId
                      )
                    : null;

                  // Find the data source for this mapping to show additional info
                  const relatedDataSource = dataSources.find(
                    (ds) => ds.site_id === mapping.siteId
                  );

                  return (
                    <Card
                      key={mapping.siteId}
                      className={isPending ? "border-orange-200 " : ""}
                    >
                      <CardContent>
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h4 className="font-medium">
                                {mapping.siteName}
                              </h4>
                              {isPending && (
                                <Badge
                                  variant="outline"
                                  className="text-orange-600 border-orange-200"
                                >
                                  Pending
                                </Badge>
                              )}
                              {relatedDataSource && (
                                <Badge variant="secondary" className="text-xs">
                                  Connected
                                </Badge>
                              )}
                            </div>
                            {currentSophos ? (
                              <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                                <Link2 className="w-4 h-4" />
                                <span>{currentSophos.name}</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Unlink className="w-4 h-4" />
                                <span>Not mapped</span>
                              </div>
                            )}
                            {relatedDataSource?.last_sync_at && (
                              <div className="text-xs text-muted-foreground mt-1">
                                Last synced:{" "}
                                {new Date(
                                  relatedDataSource.last_sync_at
                                ).toLocaleDateString()}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2 w-96">
                            <SearchBox
                              placeholder="Select Sophos tenant..."
                              defaultValue={currentSophosId}
                              options={sophosSites.map((s) => ({
                                label: s.showAs,
                                value: s.id,
                              }))}
                              onSelect={(v) =>
                                handleMappingChange(mapping.siteId, v)
                              }
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
