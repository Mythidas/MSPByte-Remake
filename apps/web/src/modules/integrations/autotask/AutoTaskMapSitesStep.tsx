"use client";

import { DataTable } from "@/components/table/DataTable";
import { Badge } from "@workspace/ui/components/badge";
import { insertRows, getRows } from "@/lib/supabase/orm";
import {
  DataTableColumn,
  DataTableView,
  DataTableAction,
  DataTableFetchParams,
  DataTableFetchResult,
} from "@/lib/types/datatable";
import { Tables, TablesInsert } from "@workspace/shared/types/database";
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
  const columns: DataTableColumn<Tables<"autotask_companies_view">>[] = useMemo(
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
        key: "is_linked",
        label: "Status",
        sortable: true,
        render: (_, row) => (
          <Badge variant={row.is_linked ? "default" : "secondary"}>
            {row.is_linked ? "Linked" : "Unlinked"}
          </Badge>
        ),
      },
      {
        key: "linked_site_name",
        label: "Linked Site",
        sortable: true,
        render: (_, row) => {
          if (row.is_linked && row.linked_site_name) {
            return (
              <div className="flex items-center gap-2">
                <span>{row.linked_site_name}</span>
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
  const actions: DataTableAction<Tables<"autotask_companies_view">>[] = useMemo(
    () => [
      {
        id: "map-sites",
        label: "Map to Sites",
        variant: "default",
        disabled: (rows) => {
          return rows.length === 0 || rows.some((row) => row.is_linked);
        },
        onClick: async (rows) => {
          const unlinkedCompanies = rows.filter((row) => !row.is_linked);

          if (unlinkedCompanies.length === 0) {
            toast.error("No unlinked companies selected");
            return;
          }

          try {
            // Prepare site records for insertion
            const siteRecords = unlinkedCompanies.map(
              (company) =>
                ({
                  name: company.name || "Unknown Company",
                  psa_company_id: company.external_id!,
                  psa_integration_id: "", // Default empty
                  psa_parent_company_id: "", // Default empty
                  status: "active",
                  tenant_id: "", // This should be populated with actual tenant ID
                  slug: (company.name || "unknown")
                    .toLowerCase()
                    .replace(/[^a-z0-9]/g, "-"),
                  created_at: new Date().toISOString(),
                }) as TablesInsert<"sites">
            );

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
  ): Promise<DataTableFetchResult<Tables<"autotask_companies_view">>> => {
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
