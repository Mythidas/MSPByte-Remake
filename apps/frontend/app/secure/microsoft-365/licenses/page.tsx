"use client";

import { useQuery } from "convex/react";
import { api, Doc } from "@/lib/api";
import { DataTable, DataTableColumn, TableView } from "@/components/DataTable";
import {
  AlertCircle,
  AlertTriangle,
  TrendingUp,
  Building2,
} from "lucide-react";
import Loader from "@workspace/ui/components/Loader";
import Link from "next/link";
import { useApp } from "@/lib/hooks/useApp";
import { useAuthReady } from "@/lib/hooks/useAuthReady";
import { prettyText } from "@workspace/shared/lib/utils";
import { M365NormalLicense } from "@workspace/shared/types/integrations/microsoft-365/licenses.js";

type LicenseEntity = Omit<Doc<"entities">, 'rawData'> & { rawData: M365NormalLicense };

export default function Microsoft365Licenses() {
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

  // Fetch licenses (tenant-wide, filter by dataSourceId)
  const licenses = useQuery(
    api.helpers.orm.list,
    !authLoading && isAuthenticated && currentSite && dataSource
      ? {
          tableName: "entities",
          index: {
            name: "by_data_source_type",
            params: {
              dataSourceId: dataSource._id,
              entityType: "licenses",
            },
          },
        }
      : "skip",
  ) as LicenseEntity[] | undefined;

  // Define columns
  const columns: DataTableColumn<LicenseEntity>[] = [
    {
      key: "rawData.friendlyName",
      title: "License Name",
      sortable: true,
      searchable: true,
      cell: ({ row }) =>
        row.rawData.friendlyName || row.rawData.skuPartNumber || "-",
      filter: {
        type: "text",
        operators: ["eq", "ne", "contains", "startsWith"],
        placeholder: "Filter by name...",
      },
    },
    {
      key: "rawData.skuPartNumber",
      title: "SKU",
      sortable: true,
      cell: ({ row }) => {
        const sku = row.rawData.skuPartNumber;
        if (!sku) return <span className="text-muted-foreground">-</span>;

        return (
          <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{sku}</code>
        );
      },
      filter: {
        type: "text",
        operators: ["eq", "contains"],
        placeholder: "Filter by SKU...",
      },
    },
    {
      key: "rawData.accountName",
      title: "Account",
      sortable: true,
      cell: ({ row }) => row.rawData?.accountName,
    },
    {
      key: "normalizedData.totalUnits",
      title: "Total",
      sortable: true,
      cell: ({ row }) => {
        const total = row.rawData.prepaidUnits.enabled;
        if (total === undefined || total === null) {
          return <span className="text-muted-foreground">-</span>;
        }
        return <span className="font-mono">{total.toLocaleString()}</span>;
      },
      filter: {
        type: "number",
        operators: ["eq", "gt", "gte", "lt", "lte"],
      },
    },

    {
      key: "rawData.consumedUnits",
      title: "Consumed",
      sortable: true,
      cell: ({ row }) => {
        const consumed = row.rawData.consumedUnits;
        if (consumed === undefined || consumed === null) {
          return <span className="text-muted-foreground">-</span>;
        }
        return <span className="font-mono">{consumed.toLocaleString()}</span>;
      },
      filter: {
        type: "number",
        operators: ["eq", "gt", "gte", "lt", "lte"],
      },
    },
    {
      key: "utilization",
      title: "Utilization",
      sortable: false,
      cell: ({ row }) => {
        const total = row.rawData.prepaidUnits.enabled;
        const consumed = row.rawData.consumedUnits;

        if (!total || consumed === undefined || consumed === null) {
          return <span className="text-muted-foreground">-</span>;
        }

        const percentage = Math.round((consumed / total) * 100);
        const isOverused = percentage > 90;
        const isHighUsage = percentage > 75 && percentage <= 90;

        return (
          <div className="flex items-center gap-2">
            <div className="w-24 bg-muted rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${
                  isOverused
                    ? "bg-red-500"
                    : isHighUsage
                      ? "bg-yellow-500"
                      : "bg-green-500"
                }`}
                style={{ width: `${Math.min(percentage, 100)}%` }}
              />
            </div>
            <span
              className={`text-sm font-medium ${
                isOverused
                  ? "text-red-500"
                  : isHighUsage
                    ? "text-yellow-500"
                    : ""
              }`}
            >
              {percentage}%
            </span>
          </div>
        );
      },
    },
    {
      key: "tags",
      title: "Tags",
      cell: ({ row }) => {
        const tags = row.tags || [];
        if (!tags.length)
          return <span className="text-muted-foreground">-</span>;

        const tagConfig: Record<string, { color: string; icon: any }> = {
          bloat: {
            color: "bg-yellow-500/50 border-yellow-500",
            icon: AlertTriangle,
          },
          overused: { color: "bg-red-500/50 border-red-500", icon: TrendingUp },
        };

        return (
          <div className="flex flex-wrap gap-1">
            {tags.map((tag: string) => {
              const config = tagConfig[tag.toLowerCase()] || {
                color: "bg-muted border-border",
                icon: null,
              };
              const Icon = config.icon;

              return (
                <span
                  key={tag}
                  className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs ${config.color}`}
                >
                  {Icon && <Icon className="w-3 h-3" />}
                  {prettyText(tag)}
                </span>
              );
            })}
          </div>
        );
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
        });
      },
    },
  ];

  // Define views
  const views: TableView[] = [
    {
      id: "overused",
      label: "Overused",
      filters: [
        {
          field: "normalizedData.tags",
          operator: "contains",
          value: "overused",
        },
      ],
    },
    {
      id: "bloat",
      label: "Potential Bloat",
      filters: [
        {
          field: "normalizedData.tags",
          operator: "contains",
          value: "bloat",
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
          Microsoft 365 Licenses
        </h1>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Building2 className="w-4 h-4" />
          <p>{currentSite.name}</p>
        </div>
      </div>
      {licenses ? (
        <DataTable
          data={licenses}
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
