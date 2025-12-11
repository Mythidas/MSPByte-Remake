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
import { useApp } from "@/lib/hooks/useApp";
import { useAuthReady } from "@/lib/hooks/useAuthReady";
import { Building2, AlertCircle } from "lucide-react";
import Link from "next/link";

type Company = Doc<"entities">;

export default function MSPAgentSitesPage() {
  const { site: currentSite } = useApp();
  const { isLoading: authLoading, isAuthenticated } = useAuthReady();

  // Fetch companies (sites) for the current site
  const companies = useQuery(
    api.helpers.orm.list,
    !authLoading && isAuthenticated && currentSite
      ? {
          tableName: "entities",
          index: {
            name: "by_site_type",
            params: {
              siteId: currentSite._id,
              entityType: "companies",
            },
          },
        }
      : "skip",
  ) as Company[] | undefined;

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

  // Define columns
  const columns: DataTableColumn<Company>[] = [
    {
      key: "externalId",
      title: "Company ID",
      sortable: true,
      searchable: true,
      cell: ({ value }) => value || "-",
      filter: {
        type: "text",
        operators: ["eq", "ne", "contains"],
        placeholder: "Filter by ID...",
      },
    },
    {
      key: "rawData",
      title: "Company Name",
      sortable: true,
      searchable: true,
      cell: ({ row }) => {
        const data = row.rawData as any;
        return data?.name || data?.client_name || "-";
      },
      filter: {
        type: "text",
        operators: ["eq", "ne", "contains", "startsWith", "endsWith"],
        placeholder: "Filter by name...",
      },
    },
    {
      key: "state",
      title: "State",
      sortable: true,
      cell: ({ value }) => {
        const stateColors = {
          active: "bg-green-500/50",
          inactive: "bg-gray-500/50",
          error: "bg-red-500/50",
        };
        return (
          <span
            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${stateColors[value as keyof typeof stateColors] || "bg-gray-500/50"}`}
          >
            {value || "unknown"}
          </span>
        );
      },
      filter: {
        type: "select",
        operators: ["eq", "ne", "in", "nin"],
        options: [
          { label: "Active", value: "active" },
          { label: "Inactive", value: "inactive" },
          { label: "Error", value: "error" },
        ],
      },
    },
    {
      key: "lastSeenAt",
      title: "Last Seen",
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
          field: "state",
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
          field: "state",
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
            href="/secure/msp-agent"
            className="text-muted-foreground hover:text-foreground"
          >
            MSP Agent
          </Link>
          <span className="text-muted-foreground">/</span>
          <h1 className="text-3xl font-bold tracking-tight">Sites</h1>
        </div>
        <p className="text-muted-foreground">
          Managed sites for {currentSite.name}
        </p>
      </div>
      {companies !== undefined ? (
        companies.length > 0 ? (
          <DataTable
            data={companies}
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
            <p className="text-muted-foreground">
              No companies found for this site
            </p>
          </div>
        )
      ) : (
        <Loader />
      )}
    </div>
  );
}
