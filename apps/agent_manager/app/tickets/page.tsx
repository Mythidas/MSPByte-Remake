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

type Ticket = Doc<"ticket_usage">;

export default function TicketsPage() {
  const { site: currentSite } = useApp();

  // Fetch tickets for the current site using *_s variant
  const tickets = useQuery(
    api.helpers.orm.list_s,
    currentSite
      ? {
          secret: process.env.NEXT_PUBLIC_CONVEX_SECRET!,
          tableName: "ticket_usage",
          index: {
            name: "by_site",
            params: {
              siteId: currentSite._id,
            },
          },
        }
      : "skip",
  ) as Ticket[] | undefined;

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
  const columns: DataTableColumn<Ticket>[] = [
    {
      key: "ticketId",
      title: "Ticket ID",
      sortable: true,
      searchable: true,
      filter: {
        type: "text",
        operators: ["eq", "ne", "contains"],
        placeholder: "Filter by ticket ID...",
      },
    },
    {
      key: "ticketSummary",
      title: "Summary",
      sortable: true,
      searchable: true,
      cell: ({ value }) => (
        <div className="max-w-md truncate" title={value}>
          {value}
        </div>
      ),
      filter: {
        type: "text",
        operators: ["eq", "ne", "contains", "startsWith", "endsWith"],
        placeholder: "Filter by summary...",
      },
    },
    {
      key: "endpoint",
      title: "Endpoint",
      sortable: true,
      searchable: true,
      cell: ({ value }) => {
        // Extract hostname from endpoint if it's a URL
        try {
          const url = new URL(value);
          return url.hostname;
        } catch {
          return value || "-";
        }
      },
      filter: {
        type: "text",
        operators: ["eq", "ne", "contains"],
        placeholder: "Filter by endpoint...",
      },
    },
    {
      key: "psaType",
      title: "PSA Type",
      sortable: true,
      cell: ({ value }) => value || "-",
      filter: {
        type: "select",
        operators: ["eq", "ne"],
        options: [{ label: "HaloPSA", value: "halopsa" }],
      },
    },
    {
      key: "billingPeriod",
      title: "Billing Period",
      sortable: true,
      cell: ({ value }) => value || "-",
      filter: {
        type: "text",
        operators: ["eq", "ne", "gte", "lte"],
        placeholder: "Filter by period (YYYY-MM)...",
      },
    },
    {
      key: "createdAt",
      title: "Created At",
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

  // Get unique billing periods for views
  const billingPeriods = tickets
    ? Array.from(new Set(tickets.map((t) => t.billingPeriod)))
        .sort()
        .reverse()
    : [];

  // Define views - current month and last 2 months
  const views: TableView[] = billingPeriods.slice(0, 3).map((period) => ({
    id: period,
    label: period,
    filters: [
      {
        field: "billingPeriod",
        operator: "eq",
        value: period,
      },
    ],
  }));

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
          <h1 className="text-3xl font-bold tracking-tight">Tickets</h1>
        </div>
        <p className="text-muted-foreground">
          Support tickets submitted for {currentSite.name}
        </p>
      </div>
      {tickets !== undefined ? (
        tickets.length > 0 ? (
          <DataTable
            data={tickets}
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
              No tickets found for this site
            </p>
          </div>
        )
      ) : (
        <Loader />
      )}
    </div>
  );
}
