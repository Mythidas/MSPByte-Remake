"use client";

import { useState, useMemo, useEffect } from "react";
import { DataTable } from "@/components/table/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getRows } from "@/lib/supabase/orm";
import {
  DataTableColumn,
  DataTableView,
  DataTableAction,
  DataTableFetchParams,
  DataTableFetchResult,
} from "@/lib/types/datatable";
import { Unlink } from "lucide-react";
import { toast } from "sonner";
import SearchBox from "@/components/SearchBox";
import { deleteRows, insertRows } from "@/lib/supabase/orm";
import { SophosTenantConfig } from "@workspace/shared/types/integrations/sophos-partner";
import { Tables } from "@workspace/shared/types/database";
import { APIResponse } from "@workspace/shared/types/api";
import { SophosPartnerTenant } from "@workspace/shared/types/integrations/sophos-partner/tenants";
import { useSophosTenantsStore } from "@/lib/stores/sophos-tenants";

type Props = {
  integration: Tables<"integrations">;
};

export default function SophosPartnerMapSitesStep({ integration }: Props) {
  const [mapping, setMapping] = useState(false);

  const store = useSophosTenantsStore();
  const tenants = store.getTenants(integration.id);
  const loadingTenants = store.isLoading(integration.id);


  useEffect(() => {
    // Only fetch if we don't already have tenants
    if (tenants || loadingTenants) return;

    const fetchTenants = async () => {
      store.setLoading(integration.id, true);

      try {
        const response = await fetch(
          `/api/v1.0/integrations/sophos-partner/tenants?integrationId=${integration.id}`,
          {
            method: "GET",
          }
        );


        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result: APIResponse<SophosPartnerTenant[]> = await response.json();

        if (result.error) {
          throw new Error(result.error.message);
        }

        store.setTenants(integration.id, result.data || []);
      } catch (error) {
        store.setLoading(integration.id, false);
      }
    };

    fetchTenants();
  }, [integration.id, tenants, loadingTenants, store]);


  // Convert tenants to SearchBox options
  const tenantOptions = useMemo(
    () =>
      (tenants || []).map((tenant) => ({
        label: tenant.name,
        value: tenant.id,
      })),
    [tenants]
  );

  // Handle mapping a site to a tenant
  const handleMapSite = async (
    site: Tables<"sophos_partner_sites_view">,
    tenantId: string
  ) => {
    const tenant = (tenants || []).find((t) => t.id === tenantId);
    if (!tenant) {
      toast.error("Selected tenant not found");
      return;
    }

    setMapping(true);
    try {
      const tenantConfig: SophosTenantConfig = {
        api_host: tenant.apiHost,
        tenant_name: tenant.name,
      };

      // Create a data source entry for this site mapping
      const result = await insertRows("data_sources", {
        rows: [
          {
            integration_id: integration.id,
            site_id: site.id!,
            config: tenantConfig,
            status: "connected",
            external_id: tenant.id,
            credential_expiration_at: new Date(
              Date.now() + 365 * 24 * 60 * 60 * 1000
            ).toISOString(), // 1 year from now
            tenant_id: site.tenant_id!,
          },
        ],
      });

      if (!result.error) {
        toast.success(`Site mapped to ${tenant.name} successfully!`);
        // Refresh the data table - trigger a refresh
        window.location.reload(); // Simple refresh, could be improved with state management
      } else {
        toast.error(result.error.message || "Failed to map site");
      }
    } catch (error) {
      console.error("Error mapping site:", error);
      toast.error("An unexpected error occurred");
    } finally {
      setMapping(false);
    }
  };

  // Handle unmapping a site
  const handleUnmapSite = async (siteId: string) => {
    setMapping(true);
    try {
      const result = await deleteRows("data_sources", {
        filters: [
          ["site_id", "eq", siteId],
          ["integration_id", "eq", integration.id],
        ],
      });
      if (!result.error) {
        toast.success("Site unmapped successfully!");
        // Refresh the data table - trigger a refresh
        window.location.reload(); // Simple refresh, could be improved with state management
      } else {
        toast.error(result.error.message || "Failed to unmap site");
      }
    } catch (error) {
      console.error("Error unmapping site:", error);
      toast.error("An unexpected error occurred");
    } finally {
      setMapping(false);
    }
  };

  // Define columns
  const columns: DataTableColumn<Tables<"sophos_partner_sites_view">>[] =
    useMemo(
      () => [
        {
          key: "name",
          label: "Site Name",
          sortable: true,
          searchable: true,
          render: (value) => <span className="font-medium">{value}</span>,
        },
        {
          key: "isLinked",
          label: "Status",
          sortable: true,
          render: (_, row) => (
            <Badge variant={row.is_linked ? "default" : "secondary"}>
              {row.is_linked ? "Mapped" : "Unmapped"}
            </Badge>
          ),
        },
        {
          key: "linkedTenantName",
          label: "Sophos Tenant",
          sortable: true,
          render: (_, row) => {
            if (row.is_linked && row.linked_tenant_name) {
              return (
                <div className="flex items-center gap-2">
                  <span>{row.linked_tenant_name}</span>
                </div>
              );
            }
            return <span className="text-muted-foreground">-</span>;
          },
        },
        {
          key: "actions",
          label: "Actions",
          render: (_, row) => (
            <div className="flex gap-2">
              {!row.is_linked ? (
                <div className="flex items-center gap-2 w-96">
                  <SearchBox
                    options={tenantOptions}
                    placeholder="Select Sophos Tenant..."
                    loading={loadingTenants}
                    onSelect={(tenantId) => handleMapSite(row, tenantId)}
                  />
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={mapping}
                  onClick={() => handleUnmapSite(row.id!)}
                >
                  <Unlink className="w-3 h-3" />
                  Unmap
                </Button>
              )}
            </div>
          ),
        },
      ],
      [tenantOptions, loadingTenants, mapping]
    );

  // Define views
  const views: DataTableView[] = useMemo(
    () => [
      {
        id: "mapped",
        name: "Mapped",
        filters: [
          {
            column: "is_linked",
            operator: "eq",
            value: "true",
          },
        ],
      },
      {
        id: "unmapped",
        name: "Unmapped",
        filters: [
          {
            column: "is_linked",
            operator: "eq",
            value: "false",
          },
        ],
      },
    ],
    []
  );

  // Define actions (for batch operations)
  const actions: DataTableAction<Tables<"sophos_partner_sites_view">>[] =
    useMemo(
      () => [
        {
          id: "unmap-sites",
          label: "Unmap Sites",
          variant: "destructive",
          disabled: (rows) => {
            return rows.length === 0 || rows.some((row) => !row.is_linked);
          },
          onClick: async (rows) => {
            const mappedSites = rows.filter((row) => row.is_linked);

            if (mappedSites.length === 0) {
              toast.error("No mapped sites selected");
              return;
            }

            setMapping(true);
            try {
              // Unmap all selected sites
              for (const site of mappedSites) {
                await deleteRows("data_sources", {
                  filters: [
                    ["site_id", "eq", site.id],
                    ["integration_id", "eq", integration.id],
                  ],
                });
              }

              toast.success(
                `Successfully unmapped ${mappedSites.length} site(s)`
              );
              // Refresh the data table
              window.location.reload();
            } catch (error) {
              console.error("Error unmapping sites:", error);
              toast.error("An unexpected error occurred");
            } finally {
              setMapping(false);
            }
          },
        },
      ],
      []
    );

  // Data fetcher function
  const fetcher = async (
    params: DataTableFetchParams
  ): Promise<DataTableFetchResult<Tables<"sophos_partner_sites_view">>> => {
    try {
      const response = await getRows("sophos_partner_sites_view", {
        pagination: params,
      });

      if (response.error) {
        return {
          data: [],
          count: 0,
          error: "Failed to load sites",
        };
      }

      return {
        data: response.data.rows,
        count: response.data.total,
      };
    } catch (error) {
      console.error("Error in fetcher:", error);
      return {
        data: [],
        count: 0,
        error: "An unexpected error occurred",
      };
    }
  };

  return (
    <div className="flex flex-col gap-4 size-full pb-10">
      <div className="flex shrink items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">
            Map Sites to Sophos Partner Tenants
          </h3>
          <p className="text-sm text-muted-foreground">
            Link your sites to Sophos Partner tenants for data synchronization
          </p>
        </div>
      </div>

      <DataTable
        columns={columns}
        fetcher={fetcher}
        views={views}
        actions={actions}
        enableSearch={true}
        enableSelection={true}
        enableRefresh={true}
        searchPlaceholder="Search sites..."
        emptyMessage="No sites found"
      />
    </div>
  );
}
