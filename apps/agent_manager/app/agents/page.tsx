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
import { Building2, AlertCircle } from "lucide-react";
import Link from "next/link";
import { prettyText } from "@workspace/shared/lib/utils";

type Agent = Doc<"agents">;

export default function AgentsPage() {
  const { site: currentSite } = useApp();

  // Fetch agents for the current site using *_s variant
  const agents = useQuery(
    api.helpers.orm.list_s,
    currentSite
      ? {
          secret: process.env.NEXT_PUBLIC_CONVEX_SECRET!,
          tableName: "agents",
          index: {
            name: "by_site",
            params: {
              siteId: currentSite._id,
            },
          },
        }
      : "skip",
  ) as Agent[] | undefined;

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
  const columns: DataTableColumn<Agent>[] = [
    {
      key: "hostname",
      title: "Hostname",
      sortable: true,
      searchable: true,
      filter: {
        type: "text",
        operators: ["eq", "ne", "contains", "startsWith", "endsWith"],
        placeholder: "Filter by hostname...",
      },
    },
    {
      key: "platform",
      title: "Platform",
      sortable: true,
      cell: ({ value }) => prettyText(value),
      filter: {
        type: "select",
        operators: ["eq", "ne", "in", "nin"],
        options: [
          { label: "Windows", value: "windows" },
          { label: "Linux", value: "linux" },
          { label: "macOS", value: "darwin" },
        ],
      },
    },
    {
      key: "ipAddress",
      title: "IP Address",
      sortable: true,
      searchable: true,
      cell: ({ value }) => value || "-",
      filter: {
        type: "text",
        operators: ["eq", "ne", "contains"],
        placeholder: "Filter by IP...",
      },
    },
    {
      key: "version",
      title: "Agent Version",
      sortable: true,
      cell: ({ value }) => value || "-",
      filter: {
        type: "text",
        operators: ["eq", "ne", "contains"],
        placeholder: "Filter by version...",
      },
    },
    {
      key: "status",
      title: "Status",
      sortable: true,
      cell: ({ value }) => {
        const statusColors = {
          online: "bg-green-500/50",
          offline: "bg-red-500/50",
          idle: "bg-yellow-500/50",
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
          { label: "Online", value: "online" },
          { label: "Offline", value: "offline" },
          { label: "Idle", value: "idle" },
        ],
      },
    },
    {
      key: "statusChangedAt",
      title: "Status Changed",
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
      id: "online",
      label: "Online",
      filters: [
        {
          field: "status",
          operator: "eq",
          value: "online",
        },
      ],
    },
    {
      id: "offline",
      label: "Offline",
      filters: [
        {
          field: "status",
          operator: "eq",
          value: "offline",
        },
      ],
    },
    {
      id: "windows",
      label: "Windows",
      filters: [
        {
          field: "platform",
          operator: "eq",
          value: "windows",
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
          <h1 className="text-3xl font-bold tracking-tight">Agents</h1>
        </div>
        <p className="text-muted-foreground">
          Monitored endpoints for {currentSite.name}
        </p>
      </div>
      {agents !== undefined ? (
        agents.length > 0 ? (
          <DataTable
            data={agents}
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
              No agents found for this site
            </p>
          </div>
        )
      ) : (
        <Loader />
      )}
    </div>
  );
}
