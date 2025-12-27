"use client";

import { useQuery } from "convex/react";
import {
  DataTable,
  DataTableColumn,
  TableView,
} from "@/components/DataTable";
import { api } from "@/lib/api";
import type { Doc } from "@workspace/database/convex/_generated/dataModel";
import Loader from "@workspace/ui/components/Loader";
import { AlertCircle } from "lucide-react";
import Link from "next/link";
import { prettyText } from "@workspace/shared/lib/utils";

type Site = Doc<"sites">;

export default function SitesPage() {
  // Fetch all sites using *_s variant
  const sites = useQuery(api.helpers.orm.list_s, {
    secret: process.env.NEXT_PUBLIC_CONVEX_SECRET!,
    tableName: "sites",
  }) as Site[] | undefined;

  // Define columns
  const columns: DataTableColumn<Site>[] = [
    {
      key: "name",
      title: "Name",
      sortable: true,
      searchable: true,
      filter: {
        type: "text",
        operators: ["eq", "ne", "contains", "startsWith", "endsWith"],
        placeholder: "Filter by name...",
      },
    },
    {
      key: "slug",
      title: "Slug",
      sortable: true,
      searchable: true,
      filter: {
        type: "text",
        operators: ["eq", "ne", "contains"],
        placeholder: "Filter by slug...",
      },
    },
    {
      key: "status",
      title: "Status",
      sortable: true,
      cell: ({ value }) => {
        const statusColors = {
          active: "bg-green-500/50",
          inactive: "bg-gray-500/50",
          archived: "bg-red-500/50",
        };
        return (
          <span
            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusColors[value as keyof typeof statusColors] || "bg-gray-500/50"}`}
          >
            {prettyText(value)}
          </span>
        );
      },
      filter: {
        type: "select",
        operators: ["eq", "ne", "in", "nin"],
        options: [
          { label: "Active", value: "active" },
          { label: "Inactive", value: "inactive" },
          { label: "Archived", value: "archived" },
        ],
      },
    },
    {
      key: "psaCompanyId",
      title: "PSA Company ID",
      sortable: true,
      cell: ({ value }) => value || "-",
      filter: {
        type: "text",
        operators: ["eq", "ne", "contains"],
        placeholder: "Filter by PSA ID...",
      },
    },
    {
      key: "updatedAt",
      title: "Updated At",
      sortable: true,
      cell: ({ value }) => {
        if (!value) return "-";
        return new Date(value).toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
      },
      filter: {
        type: "date",
        operators: ["eq", "gt", "gte", "lt", "lte"],
      },
    },
  ];

  // Define views
  const views: TableView[] = [
    {
      id: "active",
      label: "Active",
      filters: [
        {
          field: "status",
          operator: "eq",
          value: "active",
        },
      ],
    },
    {
      id: "inactive",
      label: "Inactive",
      filters: [
        {
          field: "status",
          operator: "eq",
          value: "inactive",
        },
      ],
    },
  ];

  return (
    <div className="flex flex-col size-full gap-2 mx-auto">
      <div>
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard"
            className="text-muted-foreground hover:text-foreground"
          >
            Dashboard
          </Link>
          <span className="text-muted-foreground">/</span>
          <h1 className="text-3xl font-bold tracking-tight">Sites</h1>
        </div>
        <p className="text-muted-foreground">All managed sites</p>
      </div>
      {sites !== undefined ? (
        sites.length > 0 ? (
          <DataTable
            data={sites}
            columns={columns}
            views={views}
            enableRowSelection={false}
            enableGlobalSearch={true}
            enableFilters={true}
            enablePagination={true}
            enableColumnToggle={true}
            enableURLState={true}
          />
        ) : (
          <div className="flex flex-col gap-4 items-center justify-center size-full">
            <AlertCircle className="w-12 h-12 text-muted-foreground" />
            <p className="text-muted-foreground">No sites found</p>
          </div>
        )
      ) : (
        <Loader />
      )}
    </div>
  );
}
