"use client";

import { DataTableColumn } from "@/components/DataTable";
import { Doc } from "@/lib/api";
import { AlertCircle, CheckCircle, XCircle, EyeOff } from "lucide-react";
import { prettyText } from "@workspace/shared/lib/utils";

type Alert = Doc<"entity_alerts">;

/**
 * Returns column definitions for the Alerts DataTable
 */
export function useAlertColumns(): DataTableColumn<Alert>[] {
  return [
    {
      key: "alertType",
      title: "Alert Type",
      sortable: true,
      searchable: true,
      cell: ({ row }) => prettyText(row.alertType),
      filter: {
        type: "text",
        operators: ["eq", "ne", "contains"],
        placeholder: "Filter by type...",
      },
    },
    {
      key: "severity",
      title: "Severity",
      sortable: true,
      cell: ({ row }) => {
        const severityConfig = {
          low: { color: "bg-blue-500/50 border-blue-500/50", label: "Low" },
          medium: {
            color: "bg-yellow-500/50 border-yellow-500/50",
            label: "Medium",
          },
          high: {
            color: "bg-orange-500/50 border-orange-500/50",
            label: "High",
          },
          critical: {
            color: "bg-red-500/50 border-red-500/50",
            label: "Critical",
          },
        };
        const config = severityConfig[row.severity];

        return (
          <span
            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${config.color}`}
          >
            {config.label}
          </span>
        );
      },
      filter: {
        type: "select",
        operators: ["eq", "ne"],
        options: [
          { label: "Low", value: "low" },
          { label: "Medium", value: "medium" },
          { label: "High", value: "high" },
          { label: "Critical", value: "critical" },
        ],
      },
    },
    {
      key: "message",
      title: "Message",
      searchable: true,
      cell: ({ row }) => (
        <div className="max-w-md truncate" title={row.message}>
          {row.message}
        </div>
      ),
      filter: {
        type: "text",
        operators: ["contains"],
        placeholder: "Search message...",
      },
    },
    {
      key: "status",
      title: "Status",
      sortable: true,
      cell: ({ row }) => {
        const statusConfig = {
          active: {
            color: "bg-green-500/50 border-green-500/50",
            label: "Active",
            icon: AlertCircle,
          },
          suppressed: {
            color: "bg-gray-500/50 border-gray-500/50",
            label: "Suppressed",
            icon: EyeOff,
          },
          resolved: {
            color: "bg-blue-500/50 border-blue-500/50",
            label: "Resolved",
            icon: CheckCircle,
          },
        };
        const config = statusConfig[row.status];
        const Icon = config.icon;

        return (
          <div className="flex items-center gap-2">
            <Icon className="w-4 h-4" />
            <span
              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${config.color}`}
            >
              {config.label}
            </span>
          </div>
        );
      },
      filter: {
        type: "select",
        operators: ["eq", "ne"],
        options: [
          { label: "Active", value: "active" },
          { label: "Suppressed", value: "suppressed" },
          { label: "Resolved", value: "resolved" },
        ],
      },
    },
    {
      key: "_creationTime",
      title: "Created",
      sortable: true,
      cell: ({ row }) => {
        const date = new Date(row._creationTime);
        return (
          <div className="text-sm">
            <div>
              {date.toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </div>
            <div className="text-xs text-muted-foreground">
              {date.toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
          </div>
        );
      },
      filter: {
        type: "date",
        operators: ["eq", "gt", "gte", "lt", "lte"],
      },
    },
    {
      key: "updatedAt",
      title: "Last Updated",
      sortable: true,
      cell: ({ row }) => {
        const date = new Date(row.updatedAt);
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
  ];
}
