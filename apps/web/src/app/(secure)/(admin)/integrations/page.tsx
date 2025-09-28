"use client";

import { Badge } from "@workspace/ui/components/badge";
import { Plug, CheckCircle, XCircle } from "lucide-react";
import { prettyText } from "@workspace/shared/lib/utils";
import { getRows } from "@/lib/supabase/orm";
import {
  DataTableColumn,
  DataTableAction,
  DataTableFetchParams,
  DataTableFetchResult,
  DataTableView,
} from "@/lib/types/datatable";
import { DataTable } from "@/components/table/DataTable";
import Image from "next/image";
import Link from "next/link";

// Use the integrations_view which includes data_sources_count
type IntegrationView = {
  id: string;
  name: string;
  description: string;
  category: string;
  icon_url: string | null;
  color: string | null;
  is_active: boolean | null;
  product_url: string | null;
  supported_types: string[];
  config_schema: any;
  created_at: string;
  updated_at: string;
  data_sources_count: number;
};

type IntegrationWithStatus = IntegrationView & {
  enabled: boolean;
};

const columns: DataTableColumn<IntegrationWithStatus>[] = [
  {
    key: "name",
    label: "Integration",
    width: "300px",
    sortable: true,
    searchable: true,
    render: (value, row) => (
      <Link
        className="flex items-center gap-3 hover:cursor-pointer hover:text-primary"
        href={`/integrations/${row.id}`}
      >
        {row.icon_url ? (
          <div className="h-8 w-8 rounded-md bg-muted p-1 flex items-center justify-center">
            <Image
              src={row.icon_url}
              alt={`${value} icon`}
              width={24}
              height={24}
              className="rounded object-contain"
            />
          </div>
        ) : (
          <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center">
            <Plug className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
        <span className="font-medium">{value}</span>
      </Link>
    ),
  },
  {
    key: "description",
    label: "Description",
    width: "400px",
    searchable: true,
    render: (value) => (
      <span className="text-sm text-muted-foreground line-clamp-2">
        {value}
      </span>
    ),
  },
  {
    key: "category",
    label: "Category",
    width: "120px",
    sortable: true,
    searchable: true,
    render: (value) => (
      <Badge variant="outline" className="text-xs">
        {prettyText(value)}
      </Badge>
    ),
  },
  {
    key: "enabled",
    label: "Status",
    width: "100px",
    sortable: true,
    render: (value, row) => {
      const isEnabled = value && row.data_sources_count > 0;
      return (
        <div className="flex items-center gap-2">
          {isEnabled ? (
            <>
              <CheckCircle className="h-4 w-4 text-green-600" />
              <Badge
                variant="default"
                className="text-xs bg-green-100 text-green-800"
              >
                Enabled
              </Badge>
            </>
          ) : (
            <>
              <XCircle className="h-4 w-4 text-gray-400" />
              <Badge variant="secondary" className="text-xs">
                Available
              </Badge>
            </>
          )}
        </div>
      );
    },
  },
  {
    key: "data_sources_count",
    label: "Data Sources",
    width: "100px",
    sortable: true,
    render: (value) => (
      <Badge variant="outline" className="text-xs">
        {value || 0}
      </Badge>
    ),
  },
];

const actions: DataTableAction<IntegrationWithStatus>[] = [
  {
    id: "configure",
    label: "Configure",
    icon: <Plug className="h-4 w-4" />,
    onClick: async (rows) => {
      if (rows.length === 1) {
        console.log("Configure integration:", rows[0]?.id);
      }
    },
    disabled: (rows) => rows.length !== 1,
  },
];

const views: DataTableView[] = [
  {
    id: "active-integrations",
    name: "Active Integrations",
    filters: [{ column: "data_sources_count", operator: "gte", value: "1" }],
    sorts: [{ column: "name", direction: "asc" }],
  },
  {
    id: "by-category",
    name: "By Category",
    filters: [],
    sorts: [
      { column: "category", direction: "asc" },
      { column: "name", direction: "asc" },
    ],
  },
];

export default function Integrations() {
  const fetcher = async (
    params: DataTableFetchParams
  ): Promise<DataTableFetchResult<IntegrationWithStatus>> => {
    try {
      // Use the integrations_view which includes data_sources_count
      const integrationsResult = await getRows("integrations_view" as any, {
        pagination: params,
      });

      if (integrationsResult.error) {
        return {
          data: [],
          count: 0,
          error: integrationsResult.error.message,
        };
      }

      const integrations = integrationsResult.data?.rows || [];

      // Transform the data to add the enabled field
      const integrationsWithStatus: IntegrationWithStatus[] = integrations.map(
        (integration: any) => ({
          ...integration,
          enabled:
            integration.is_active !== false ||
            integration.data_sources_count > 0,
        })
      );

      return {
        data: integrationsWithStatus,
        count: integrationsResult.data?.total || 0,
      };
    } catch (error) {
      console.error("Error fetching integrations:", error);
      return {
        data: [],
        count: 0,
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch integrations",
      };
    }
  };

  return (
    <div className="flex flex-col size-full mx-auto">
      <div className="flex shrink items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Integrations</h1>
          <p className="text-muted-foreground">
            Manage available integrations and their configurations
          </p>
        </div>
      </div>

      <DataTable
        columns={columns}
        fetcher={fetcher}
        actions={actions}
        views={views}
        initialFilters={[]}
        initialSort={[{ column: "name", direction: "asc" }]}
        enableSearch={true}
        searchPlaceholder="Search integrations"
        enableSelection={true}
        enableRefresh={true}
        enableExport={true}
        enableColumnToggle={true}
        emptyMessage="No integrations found."
        className="flex-1"
      />
    </div>
  );
}
