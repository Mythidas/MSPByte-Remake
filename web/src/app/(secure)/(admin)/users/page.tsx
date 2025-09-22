"use client";

import { Badge } from "@/components/ui/badge";
import { Eye, Edit, Trash2 } from "lucide-react";
import { prettyText } from "@workspace/shared/lib/utils";
import { Tables } from "@workspace/shared/types/database";
import { getRows } from "@/lib/supabase/orm";
import {
  DataTableColumn,
  DataTableAction,
  DataTableFetchParams,
  DataTableFetchResult,
  DataTableView,
} from "@/lib/types/datatable";
import { DataTable } from "@/components/table/DataTable";

type Data = Tables<"users_view">;

const columns: DataTableColumn<Data>[] = [
  {
    key: "name",
    label: "Name",
    sortable: true,
    searchable: true,
  },
  {
    key: "email",
    label: "Email",
    sortable: true,
    searchable: true,
  },
  {
    key: "role_name",
    label: "Role",
    sortable: true,
  },
  {
    key: "status",
    label: "Status",
    sortable: true,
    render: (value) => {
      const status = value || "unknown";
      const variant =
        status === "active"
          ? "default"
          : status === "inactive"
            ? "secondary"
            : status === "suspended"
              ? "destructive"
              : "outline";
      return <Badge variant={variant}>{prettyText(status)}</Badge>;
    },
  },
  {
    key: "last_activity_at",
    label: "Last Active",
    sortable: true,
    hideable: true,
    render: (value) => (
      <div className="text-sm">
        {value ? new Date(value).toLocaleDateString() : "Never"}
      </div>
    ),
    exportTransform: (value) => (value ? new Date(value).toISOString() : ""),
  },
  {
    key: "created_at",
    label: "Created",
    sortable: true,
    hideable: true,
    render: (value) => (
      <div className="text-sm">
        {value ? new Date(value).toLocaleDateString() : "Unknown"}
      </div>
    ),
    exportTransform: (value) => (value ? new Date(value).toISOString() : ""),
  },
];

const actions: DataTableAction<Data>[] = [
  {
    id: "view",
    label: "View Details",
    icon: <Eye className="h-4 w-4" />,
    onClick: async (rows) => {
      // Navigate to user detail page
      if (rows.length === 1) {
        window.open(`/users/${rows[0].id}`, "_blank");
      }
    },
    disabled: (rows) => rows.length !== 1,
  },
  {
    id: "edit",
    label: "Edit User",
    icon: <Edit className="h-4 w-4" />,
    onClick: async (rows) => {
      // Navigate to edit page or open modal
      if (rows.length === 1) {
        window.location.href = `/users/${rows[0].id}/edit`;
      }
    },
    disabled: (rows) => rows.length !== 1,
  },
  {
    id: "suspend",
    label: "Suspend Users",
    icon: <Trash2 className="h-4 w-4" />,
    variant: "destructive",
    disabled: (rows) =>
      rows.length === 0 || rows.some((row) => row.status === "suspended"),
    onClick: async (rows) => {
      const confirmed = confirm(
        `Are you sure you want to suspend ${rows.length} user(s)?`
      );
      if (confirmed) {
        // TODO: Implement user suspension
        console.log(
          "Suspending users:",
          rows.map((r) => r.id)
        );
      }
    },
  },
  {
    id: "activate",
    label: "Activate Users",
    icon: <Eye className="h-4 w-4" />,
    disabled: (rows) =>
      rows.length === 0 || rows.some((row) => row.status === "active"),
    onClick: async (rows) => {
      // TODO: Implement user activation
      console.log(
        "Activating users:",
        rows.map((r) => r.id)
      );
    },
  },
];

// Define predefined views for common user filters
const views: DataTableView[] = [
  {
    id: "active-users",
    name: "Active Users",
    filters: [{ column: "status", operator: "eq", value: "active" }],
    sorts: [{ column: "last_activity_at", direction: "desc" }],
  },
  {
    id: "inactive-users",
    name: "Inactive Users",
    filters: [{ column: "status", operator: "neq", value: "active" }],
    sorts: [{ column: "created_at", direction: "desc" }],
  },
  {
    id: "recent-users",
    name: "Recent Users",
    filters: [],
    sorts: [{ column: "created_at", direction: "desc" }],
  },
];

export default function Users() {
  const fetcher = async (
    params: DataTableFetchParams
  ): Promise<DataTableFetchResult<Data>> => {
    try {
      const result = await getRows("users_view", {
        pagination: params,
      });

      if (result.error) {
        return {
          data: [],
          count: 0,
          error: result.error.message,
        };
      }

      return {
        data: result.data?.rows || [],
        count: result.data?.total || 0,
      };
    } catch (error) {
      return {
        data: [],
        count: 0,
        error: error instanceof Error ? error.message : "Failed to fetch users",
      };
    }
  };

  return (
    <div className="container mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Users Management</h1>
          <p className="text-muted-foreground">
            Manage user accounts, roles, and permissions
          </p>
        </div>
      </div>

      <DataTable
        columns={columns}
        fetcher={fetcher}
        actions={actions}
        views={views}
        initialFilters={[]}
        initialSort={[{ column: "created_at", direction: "desc" }]}
        enableSearch={true}
        searchPlaceholder="Search users by name or email..."
        enableSelection={true}
        enableRefresh={true}
        enableExport={true}
        enableColumnToggle={true}
        emptyMessage="No users found. Create your first user to get started."
        className="flex-1"
      />
    </div>
  );
}
