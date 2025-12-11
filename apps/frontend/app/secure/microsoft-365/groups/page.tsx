"use client";

import { useQuery } from "convex/react";
import { api, Doc } from "@/lib/api";
import { DataTable, DataTableColumn, TableView } from "@/components/DataTable";
import { AlertCircle, Building2 } from "lucide-react";
import Loader from "@workspace/ui/components/Loader";
import Link from "next/link";
import { prettyText } from "@workspace/shared/lib/utils";
import { useApp } from "@/lib/hooks/useApp";
import { useAuthReady } from "@/lib/hooks/useAuthReady";
import { M365NormalGroup } from "@workspace/shared/types/integrations/microsoft-365/groups.js";

type GroupEntity = Omit<Doc<"entities">, "rawData"> & {
  rawData: M365NormalGroup;
};

export default function Microsoft365Groups() {
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

  // Fetch groups (tenant-wide, filter by dataSourceId)
  const groups = useQuery(
    api.helpers.orm.list,
    !authLoading && isAuthenticated && dataSource
      ? {
          tableName: "entities",
          index: {
            name: "by_data_source_type",
            params: {
              dataSourceId: dataSource._id,
              entityType: "groups",
            },
          },
        }
      : "skip",
  ) as GroupEntity[] | undefined;
  console.log(groups);

  // Define columns
  const columns: DataTableColumn<GroupEntity>[] = [
    {
      key: "rawData.displayName",
      title: "Name",
      sortable: true,
      searchable: true,
      cell: ({ row }) => row.rawData.displayName || "-",
      filter: {
        type: "text",
        operators: ["eq", "ne", "contains", "startsWith"],
        placeholder: "Filter by name...",
      },
    },
    // {
    //   key: "normalizedData.type",
    //   title: "Type",
    //   sortable: true,
    //   cell: ({ row }) => {
    //     const type = row.rawData.classification || "custom";
    //     const typeColors = {
    //       security: "bg-red-500/50",
    //       distribution: "bg-blue-500/50",
    //       modern: "bg-green-500/50",
    //       custom: "bg-purple-500/50",
    //     };
    //     return (
    //       <span
    //         className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${typeColors[type as keyof typeof typeColors] || "bg-gray-500/50"}`}
    //       >
    //         {prettyText(type)}
    //       </span>
    //     );
    //   },
    //   filter: {
    //     type: "select",
    //     operators: ["eq", "ne", "in"],
    //     options: [
    //       { label: "Security", value: "security" },
    //       { label: "Distribution", value: "distribution" },
    //       { label: "Modern (M365)", value: "modern" },
    //       { label: "Custom", value: "custom" },
    //     ],
    //   },
    // },
    {
      key: "rawData.description",
      title: "Description",
      cell: ({ row }) => {
        const description = row.rawData.description;
        if (!description)
          return <span className="text-muted-foreground">-</span>;

        return (
          <span className="line-clamp-2 max-w-md" title={description}>
            {description}
          </span>
        );
      },
      filter: {
        type: "text",
        operators: ["contains", "startsWith"],
        placeholder: "Filter by description...",
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
        });
      },
    },
  ];

  // Define views
  const views: TableView[] = [
    {
      id: "security",
      label: "Security Groups",
      filters: [
        {
          field: "normalizedData.type",
          operator: "eq",
          value: "security",
        },
      ],
    },
    {
      id: "distribution",
      label: "Distribution Lists",
      filters: [
        {
          field: "normalizedData.type",
          operator: "eq",
          value: "distribution",
        },
      ],
    },
    {
      id: "modern",
      label: "M365 Groups",
      filters: [
        {
          field: "normalizedData.type",
          operator: "eq",
          value: "modern",
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

  // Only show error if dataSource query completed and returned null
  // Don't block if it's still loading (undefined)
  if (dataSource === null) {
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
          Microsoft 365 Groups
        </h1>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Building2 className="w-4 h-4" />
          <p>{currentSite.name}</p>
        </div>
      </div>
      {groups ? (
        <DataTable
          data={groups}
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
