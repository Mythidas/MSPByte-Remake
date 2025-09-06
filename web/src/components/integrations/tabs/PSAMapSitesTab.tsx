"use client";

import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Search, Building2, CheckCircle2, Plus } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useLazyLoad } from "@/lib/hooks/useLazyLoad";
import { getRows, insertRows } from "@/lib/supabase/orm";
import { Tables, TablesInsert } from "@workspace/shared/types/database";
import SearchBar from "@/components/SearchBar";
import { Company } from "@workspace/shared/types/database/normalized";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Props = {
  integration: Tables<"integrations">;
};

type EntityWithSite = Tables<"entities"> & { has_site: boolean };

export default function PSAMapSitesTab({ integration }: Props) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterTerm, setFilterTerm] = useState("");
  const [selectedEntities, setSelectedEntities] = useState<Set<string>>(
    new Set()
  );
  const [isCreatingSites, setIsCreatingSites] = useState(false);
  const [localEntities, setLocalEntities] = useState<EntityWithSite[]>([]);

  const { filteredEntities, eligibleEntities } = useMemo(() => {
    const lowerSearch = searchTerm.toLowerCase();
    const filtered = localEntities.filter((entity) => {
      const company = entity.normalized_data as Company;
      const search = company.name.toLowerCase().includes(lowerSearch);
      const filter =
        filterTerm === "active"
          ? entity.has_site
          : filterTerm === "inactive"
            ? !entity.has_site
            : true;
      return search && filter;
    });

    const eligible = filtered.filter((entity) => !entity.has_site);

    return { filteredEntities: filtered, eligibleEntities: eligible };
  }, [localEntities, searchTerm, filterTerm]);

  const { content } = useLazyLoad({
    fetcher: async () => {
      const [{ data: sitesData }, { data: atSitesData }] = await Promise.all([
        getRows("sites", {
          filters: [["psa_integration_id", "eq", integration.id]],
        }),
        getRows("entities", {
          filters: [
            ["integration_id", "eq", integration.id],
            ["entity_type", "eq", "company"],
          ],
          sorting: [["normalized_data->name", "asc"]],
        }),
      ]);

      if (!atSitesData) {
        return null;
      }

      const entitiesWithSites: EntityWithSite[] = atSitesData.rows.map(
        (row) => {
          const site = sitesData?.rows.find(
            (site) => site.psa_company_id === row.external_id
          );
          return { ...row, has_site: !!site };
        }
      );

      // Update local state when data loads
      setLocalEntities(entitiesWithSites);

      return {
        sites: sitesData || { rows: [], total: 0 },
        entities: entitiesWithSites,
        total: atSitesData.total,
      };
    },
    render: (data) => {
      if (!data || !data.total) {
        return <span>AutoTask site sync is either incomplete or failed</span>;
      }

      // Use localEntities for current state, fallback to data.entities for initial render
      const currentEntities =
        localEntities.length > 0 ? localEntities : data.entities;

      const handleSelectEntity = (entityId: string, checked: boolean) => {
        setSelectedEntities((prev) => {
          const newSelection = new Set(prev);
          if (checked) {
            newSelection.add(entityId);
          } else {
            newSelection.delete(entityId);
          }
          return newSelection;
        });
      };

      const handleSelectAll = (checked: boolean) => {
        if (checked) {
          setSelectedEntities(
            new Set(eligibleEntities.map((entity) => entity.id))
          );
        } else {
          setSelectedEntities(new Set());
        }
      };

      const handleCreateSites = async () => {
        setIsCreatingSites(true);

        // Store original state for potential rollback
        const originalEntities = [...localEntities];

        try {
          const sitesToCreate = currentEntities
            .filter((entity) => selectedEntities.has(entity.id))
            .map(
              (entity) =>
                ({
                  tenant_id: entity.tenant_id,
                  psa_company_id: entity.external_id,
                  psa_integration_id: entity.integration_id,
                  status: "active" as const,
                }) as TablesInsert<"sites">
            );

          const { error } = await insertRows("sites", {
            rows: sitesToCreate,
          });

          if (error) {
            throw new Error(`Failed to create sites: ${error.message}`);
          }

          setLocalEntities((prev) =>
            prev.map((entity) =>
              selectedEntities.has(entity.id)
                ? { ...entity, has_site: true }
                : entity
            )
          );

          // Clear selection immediately for better UX
          setSelectedEntities(new Set());

          toast.success(
            `Successfully created ${sitesToCreate.length} site${sitesToCreate.length > 1 ? "s" : ""}`
          );
        } catch (err) {
          toast.error(err instanceof Error ? err.message : String(err));
        } finally {
          setIsCreatingSites(false);
        }
      };

      return (
        <div className="flex flex-col gap-4 size-full">
          {/* Header */}
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold">
                Create Sites from PSA Entities
              </h3>
              <p className="text-sm text-muted-foreground">
                Select entities to create corresponding sites in your SaaS
              </p>
            </div>

            {selectedEntities.size > 0 && (
              <Button onClick={handleCreateSites} disabled={isCreatingSites}>
                {isCreatingSites ? (
                  <>
                    <div className="w-4 h-4 mr-2 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    Create {selectedEntities.size} Site
                    {selectedEntities.size > 1 ? "s" : ""}
                  </>
                )}
              </Button>
            )}
          </div>

          <div className="flex w-full gap-2">
            {/* Search */}
            <SearchBar
              placeholder="Search entities..."
              lead={<Search className="w-4" />}
              onSearch={setSearchTerm}
              className="w-1/3"
            />

            <Select defaultValue="all" onValueChange={setFilterTerm}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Bulk select */}
          {eligibleEntities.length > 0 && (
            <div className="flex items-center space-x-2">
              <Checkbox
                id="select-all"
                checked={
                  selectedEntities.size === eligibleEntities.length &&
                  eligibleEntities.length > 0
                }
                onCheckedChange={handleSelectAll}
              />
              <Label htmlFor="select-all" className="text-sm">
                Select all ({eligibleEntities.length} available)
              </Label>
            </div>
          )}

          {/* Entity list */}
          <div className="text-sm text-muted-foreground">
            {filteredEntities.length} entities • {eligibleEntities.length}{" "}
            available for site creation
          </div>
          <ScrollArea className="max-h-[40vh] pr-4">
            <div className="grid gap-2">
              {filteredEntities.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <Building2 className="w-8 h-8 text-muted-foreground mb-2" />
                  <p className="text-muted-foreground">No entities found</p>
                </div>
              ) : (
                filteredEntities.map((entity) => {
                  const company = entity.normalized_data as Company;

                  return (
                    <div
                      key={entity.id}
                      className={`flex items-center justify-between px-2 py-1 rounded-lg border ${
                        entity.has_site ? "bg-muted/30" : "hover:bg-muted/50"
                      } transition-colors`}
                    >
                      <div className="flex items-center gap-3">
                        {entity.has_site ? (
                          <CheckCircle2 className="w-5 h-5 text-green-500" />
                        ) : (
                          <Checkbox
                            checked={selectedEntities.has(entity.id)}
                            onCheckedChange={(checked) =>
                              handleSelectEntity(entity.id, Boolean(checked))
                            }
                          />
                        )}

                        <div>
                          <p className="font-medium">{company.name}</p>
                          <p className="text-sm text-muted-foreground">
                            PSA ID: {entity.external_id}
                          </p>
                        </div>
                      </div>

                      <Badge
                        variant={entity.has_site ? "default" : "secondary"}
                      >
                        {entity.has_site ? "Site Exists" : "No Site"}
                      </Badge>
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>

          {/* Summary */}
          {selectedEntities.size > 0 && (
            <div className="text-sm text-muted-foreground text-center">
              {selectedEntities.size} entity
              {selectedEntities.size > 1 ? "ies" : "y"} selected for site
              creation
            </div>
          )}
        </div>
      );
    },
  });

  return content;
}
