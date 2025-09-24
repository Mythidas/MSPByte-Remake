"use client";

import { DataTable } from "@/components/table/DataTable";
import { Badge } from "@/components/ui/badge";
import { insertRows, getRows } from "@/lib/supabase/orm";
import {
  DataTableColumn,
  DataTableView,
  DataTableAction,
  DataTableFetchParams,
  DataTableFetchResult,
} from "@/lib/types/datatable";
import {
  AutoTaskCompany,
  AutoTaskCompanyView,
} from "@/modules/integrations/autotask/types";
import { ExternalLinkIcon } from "lucide-react";
import { useMemo } from "react";
import { toast } from "sonner";

type Props = {
  integration: {
    id: string;
    name: string;
  };
};

export default function AutoTaskMapSitesStep({ integration }: Props) {
  // Define columns
  const columns: DataTableColumn<AutoTaskCompany>[] = useMemo(
    () => [
      {
        key: "name",
        label: "Company Name",
        sortable: true,
        searchable: true,
        render: (value) => <span className="font-medium">{value}</span>,
      },
      {
        key: "external_id",
        label: "External ID",
        sortable: true,
        searchable: true,
        render: (value) => <span className="font-mono text-sm">{value}</span>,
      },
      {
        key: "isLinked",
        label: "Status",
        sortable: true,
        render: (_, row) => (
          <Badge variant={row.isLinked ? "default" : "secondary"}>
            {row.isLinked ? "Linked" : "Unlinked"}
          </Badge>
        ),
      },
      {
        key: "linkedSiteName",
        label: "Linked Site",
        sortable: true,
        render: (_, row) => {
          if (row.isLinked && row.linkedSiteName) {
            return (
              <div className="flex items-center gap-2">
                <span>{row.linkedSiteName}</span>
                <ExternalLinkIcon className="w-3 h-3 text-muted-foreground" />
              </div>
            );
          }
          return <span className="text-muted-foreground">-</span>;
        },
      },
    ],
    []
  );

  // Define views
  const views: DataTableView[] = useMemo(
    () => [
      {
        id: "linked",
        name: "Linked",
        filters: [
          {
            column: "is_linked",
            operator: "eq",
            value: "true",
          },
        ],
      },
      {
        id: "unlinked",
        name: "Unlinked",
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

  // Define actions
  const actions: DataTableAction<AutoTaskCompany>[] = useMemo(
    () => [
      {
        id: "map-sites",
        label: "Map to Sites",
        variant: "default",
        disabled: (rows) => {
          return rows.length === 0 || rows.some((row) => row.isLinked);
        },
        onClick: async (rows) => {
          const unlinkedCompanies = rows.filter((row) => !row.isLinked);

          if (unlinkedCompanies.length === 0) {
            toast.error("No unlinked companies selected");
            return;
          }

          try {
            // Prepare site records for insertion
            const siteRecords = unlinkedCompanies.map((company) => ({
              name: company.name || "Unknown Company",
              psa_company_id: company.external_id,
              psa_integration_id: "", // Default empty
              psa_parent_company_id: "", // Default empty
              status: "active",
              tenant_id: "", // This should be populated with actual tenant ID
              slug: (company.name || "unknown")
                .toLowerCase()
                .replace(/[^a-z0-9]/g, "-"),
              created_at: new Date().toISOString(),
            }));

            // Insert the new sites
            const insertResponse = await insertRows("sites", {
              rows: siteRecords,
            });

            if (insertResponse.error) {
              toast.error("Failed to create sites");
              return;
            }

            toast.success(
              `Successfully mapped ${insertResponse.data?.length || 0} companies to sites`
            );
          } catch (error) {
            console.error("Error mapping companies to sites:", error);
            toast.error("An unexpected error occurred");
          }
        },
      },
    ],
    []
  );

  // Data fetcher function - much simpler with the view!
  const fetcher = async (
    params: DataTableFetchParams
  ): Promise<DataTableFetchResult<AutoTaskCompany>> => {
    try {
      // Prepare filters for the view
      const filters: any[] = [["integration_id", "eq", integration.id]];

      // Add DataTable filters to ORM filters
      if (params.filters) {
        Object.entries(params.filters).forEach(([column, filter]) => {
          filters.push([column, filter.op, filter.value]);
        });
      }

      // Prepare sorting for the ORM
      const sorting = params.sorting
        ? Object.entries(params.sorting).map(
            ([column, direction]) =>
              [column, direction as "asc" | "desc"] as [string, "asc" | "desc"]
          )
        : undefined;

      // Query the view directly
      const response = await getRows("autotask_companies_view", {
        filters,
        pagination: {
          page: params.page || 0,
          size: params.size || 25,
        },
        sorting,
      });

      if (response.error) {
        return {
          data: [],
          count: 0,
          error: "Failed to load AutoTask companies",
        };
      }

      // Transform from view format to component format (camelCase naming)
      const companies: AutoTaskCompany[] = response.data.rows.map(
        (row: AutoTaskCompanyView) => ({
          id: row.id,
          external_id: row.external_id,
          integration_id: row.integration_id,
          tenant_id: row.tenant_id,
          name: row.name,
          created_at: row.created_at,
          updated_at: row.updated_at,
          isLinked: row.is_linked,
          linkedSiteId: row.linked_site_id,
          linkedSiteName: row.linked_site_name,
          linkedSiteSlug: row.linked_site_slug,
          linkedSiteStatus: row.linked_site_status,
        })
      );

      return {
        data: companies,
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
            Map AutoTask Companies to Sites
          </h3>
          <p className="text-sm text-muted-foreground">
            Link AutoTask companies to sites in your system
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
        searchPlaceholder="Search companies..."
        emptyMessage="No AutoTask companies found"
      />
    </div>
  );
}
