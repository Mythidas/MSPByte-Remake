"use client";

import { useQuery } from "convex/react";
import { api, Doc } from "@/lib/api";
import { DataTable, DataTableColumn, TableView } from "@/components/DataTable";
import {
  AlertCircle,
  CheckCircle,
  XCircle,
  FileText,
  Building2,
} from "lucide-react";
import Loader from "@workspace/ui/components/Loader";
import Link from "next/link";
import { useApp } from "@/lib/hooks/useApp";
import { useAuthReady } from "@/lib/hooks/useAuthReady";
import { M365NormalPolicy } from "@workspace/shared/types/integrations/microsoft-365/policies.js";

type PolicyEntity = Omit<Doc<"entities">, 'rawData'> & { rawData: M365NormalPolicy };

export default function Microsoft365Policies() {
  // Get selected site from app state
  const { site: currentSite } = useApp();

  // Ensure auth is ready before querying
  const { isLoading: authLoading, isAuthenticated } = useAuthReady();

  // Fetch data source mapped to this site
  const dataSource = useQuery(
    api.datasources.query.getBySiteAndIntegration,
    !authLoading && isAuthenticated && currentSite
      ? {
          siteId: currentSite._id,
          integrationId: "microsoft-365",
        }
      : "skip",
  ) as Doc<"data_sources"> | null | undefined;

  // Fetch policies (tenant-wide, filter by dataSourceId)
  const policies = useQuery(
    api.helpers.orm.list,
    !authLoading && isAuthenticated && currentSite && dataSource
      ? {
          tableName: "entities",
          index: {
            name: "by_data_source_type",
            params: {
              dataSourceId: dataSource._id,
              entityType: "policies",
            },
          },
        }
      : "skip",
  ) as PolicyEntity[] | undefined;

  // Define columns
  const columns: DataTableColumn<PolicyEntity>[] = [
    {
      key: "rawData.displayName",
      title: "Policy Name",
      sortable: true,
      searchable: true,
      cell: ({ row }) => row.rawData.displayName || "-",
      filter: {
        type: "text",
        operators: ["eq", "ne", "contains", "startsWith"],
        placeholder: "Filter by name...",
      },
    },
    {
      key: "rawData.state",
      title: "Status",
      sortable: true,
      cell: ({ row }) => {
        const status = row.rawData.state || "enabled";
        const statusConfig = {
          enabled: {
            color: "bg-green-500/50",
            icon: CheckCircle,
            text: "Enabled",
          },
          disabled: { color: "bg-red-500/50", icon: XCircle, text: "Disabled" },
          "report-only": {
            color: "bg-blue-500/50",
            icon: FileText,
            text: "Report Only",
          },
        };
        const config =
          statusConfig[status as keyof typeof statusConfig] ||
          statusConfig.enabled;
        const Icon = config.icon;

        return (
          <div className="flex items-center gap-2">
            <Icon className="w-4 h-4" />
            <span
              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${config.color}`}
            >
              {config.text}
            </span>
          </div>
        );
      },
      filter: {
        type: "select",
        operators: ["eq", "ne", "in"],
        options: [
          { label: "Enabled", value: "enabled" },
          { label: "Disabled", value: "disabled" },
          { label: "Report Only", value: "report-only" },
        ],
      },
    },
    {
      key: "rawData.createdDateTime",
      title: "Created",
      sortable: true,
      cell: ({ row }) => {
        const createdAt = row.rawData.createdDateTime;
        if (!createdAt) return <span className="text-muted-foreground">-</span>;

        const date = new Date(createdAt);
        return date.toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        });
      },
      filter: {
        type: "date",
        operators: ["eq", "gt", "gte", "lt", "lte"],
      },
    },
    {
      key: "updatedAt",
      title: "Last Synced",
      sortable: true,
      cell: ({ row }) => {
        if (!row.updatedAt) return "-";
        return new Date(row.updatedAt).toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        });
      },
    },
  ];

  // Define views
  const views: TableView[] = [
    {
      id: "enabled",
      label: "Enabled Policies",
      filters: [
        {
          field: "normalizedData.status",
          operator: "eq",
          value: "enabled",
        },
      ],
    },
    {
      id: "disabled",
      label: "Disabled Policies",
      filters: [
        {
          field: "normalizedData.status",
          operator: "eq",
          value: "disabled",
        },
      ],
    },
    {
      id: "report-only",
      label: "Report Only",
      filters: [
        {
          field: "normalizedData.status",
          operator: "eq",
          value: "report-only",
        },
      ],
    },
  ];

  // Show empty state if no site is selected
  if (!currentSite) {
    return (
      <div className="flex flex-col gap-4 items-center justify-center size-full">
        <Building2 className="w-16 h-16 text-muted-foreground" />
        <div className="text-center">
          <h2 className="text-2xl font-semibold mb-2">Select a Site</h2>
          <p className="text-muted-foreground max-w-md">
            Please select a site from the dropdown in the top navigation bar.
          </p>
        </div>
      </div>
    );
  }

  if (!dataSource) {
    return (
      <div className="flex flex-col gap-4 items-center justify-center size-full">
        <AlertCircle className="w-12 h-12 text-muted-foreground" />
        <p className="text-muted-foreground">
          Microsoft 365 integration not configured
        </p>
        <Link
          href="/secure/default/integrations"
          className="text-sm text-blue-500 hover:underline"
        >
          Configure Integration
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col size-full gap-2">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Microsoft 365 Policies
        </h1>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Building2 className="w-4 h-4" />
          <p>{currentSite.name}</p>
        </div>
      </div>
      {policies ? (
        <DataTable
          data={policies}
          columns={columns}
          views={views}
          enableRowSelection={true}
          enableGlobalSearch={true}
          enableFilters={true}
          enablePagination={true}
          enableColumnToggle={true}
          enableURLState={true}
        />
      ) : (
        <Loader />
      )}
    </div>
  );
}
