"use client";

import { useState } from "react";
import { DataTable, TableView } from "@/components/DataTable";
import { useAlertColumns } from "./useAlertColumns";
import { SuppressAlertDialog } from "./SuppressAlertDialog";
import { AlertDetailsDialog } from "./AlertDetailsDialog";
import { Doc, Id } from "@/lib/api";
import { useMutation } from "convex/react";
import { api } from "@/lib/api";
import { EyeOff, Eye } from "lucide-react";
import { toast } from "sonner";

type Alert = Doc<"entity_alerts">;

interface AlertsTableProps {
  alerts: Alert[];
  siteId: Id<"sites">;
  integrationSlug?: string;
}

export function AlertsTable({
  alerts,
  siteId,
  integrationSlug,
}: AlertsTableProps) {
  const [suppressDialogOpen, setSuppressDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedAlerts, setSelectedAlerts] = useState<Alert[]>([]);
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);

  const unsuppressAlert = useMutation(api.entity_alerts.mutate.unsuppressAlert);
  const columns = useAlertColumns();

  // Handle bulk suppress action
  const handleBulkSuppress = (rows: Alert[]) => {
    setSelectedAlerts(rows);
    setSuppressDialogOpen(true);
  };

  // Handle bulk unsuppress action
  const handleBulkUnsuppress = async (rows: Alert[]) => {
    try {
      for (const alert of rows) {
        await unsuppressAlert({ alertId: alert._id });
      }

      toast("Alerts unsupressed", {
        description: `Successfully unsuppressed ${rows.length} alert${rows.length !== 1 ? "s" : ""}.`,
      });
    } catch (error) {
      toast.error("Error", {
        description: "Failed to unsuppress alerts. Please try again.",
      });
      console.error("Failed to unsuppress alerts:", error);
    }
  };

  // Handle row click to view details
  const handleRowClick = (alert: Alert) => {
    setSelectedAlert(alert);
    setDetailsDialogOpen(true);
  };

  // Define predefined views
  const views: TableView[] = [
    {
      id: "active",
      label: "Active",
      description: "Show only active alerts",
      filters: [
        {
          field: "status",
          operator: "eq",
          value: "active",
        },
      ],
    },
    {
      id: "critical",
      label: "Critical",
      description: "Show only critical severity alerts",
      filters: [
        {
          field: "severity",
          operator: "eq",
          value: "critical",
        },
        {
          field: "status",
          operator: "eq",
          value: "active",
        },
      ],
    },
    {
      id: "high",
      label: "High Priority",
      description: "Show high and critical severity alerts",
      filters: [
        {
          field: "severity",
          operator: "in",
          value: ["high", "critical"],
        },
        {
          field: "status",
          operator: "eq",
          value: "active",
        },
      ],
    },
    {
      id: "suppressed",
      label: "Suppressed",
      description: "Show suppressed alerts",
      filters: [
        {
          field: "status",
          operator: "eq",
          value: "suppressed",
        },
      ],
    },
    {
      id: "resolved",
      label: "Resolved",
      description: "Show resolved alerts",
      filters: [
        {
          field: "status",
          operator: "eq",
          value: "resolved",
        },
      ],
    },
  ];

  // Define row actions for bulk operations
  const rowActions = [
    {
      label: "Suppress",
      icon: <EyeOff className="w-4 h-4" />,
      onClick: handleBulkSuppress,
      disabled: (rows: Alert[]) => rows.every((r) => r.status === "suppressed"),
    },
    {
      label: "Unsuppress",
      icon: <Eye className="w-4 h-4" />,
      onClick: handleBulkUnsuppress,
      disabled: (rows: Alert[]) => rows.every((r) => r.status !== "suppressed"),
    },
  ];

  return (
    <>
      <DataTable
        data={alerts}
        columns={columns}
        views={views}
        rowActions={rowActions}
        enableRowSelection={true}
        enableGlobalSearch={true}
        enableFilters={true}
        enablePagination={true}
        enableColumnToggle={true}
        enableURLState={true}
        onRowClick={handleRowClick}
      />

      {/* Suppress Dialog */}
      <SuppressAlertDialog
        open={suppressDialogOpen}
        onOpenChange={setSuppressDialogOpen}
        alerts={selectedAlerts}
        onSuccess={() => setSelectedAlerts([])}
      />

      {/* Details Dialog */}
      <AlertDetailsDialog
        open={detailsDialogOpen}
        onOpenChange={setDetailsDialogOpen}
        alert={selectedAlert}
      />
    </>
  );
}
