"use client";

import { Badge } from "@workspace/ui/components/badge";
import { Eye, Edit, Trash2, Shield, Plus } from "lucide-react";
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

type Data = Tables<"roles">;

const columns: DataTableColumn<Data>[] = [
  {
    key: "name",
    label: "Role Name",
    sortable: true,
    searchable: true,
    render: (value, row) => (
      <div className="flex items-center gap-2">
        <Shield className="h-4 w-4 text-primary" />
        <div className="flex flex-col">
          <div className="font-medium">{value}</div>
        </div>
      </div>
    ),
  },
  {
    key: "description",
    label: "Description",
    sortable: true,
    searchable: true,
    hideable: true,
  },
  {
    key: "tenant_id",
    label: "Scope",
    sortable: true,
    render: (value) => (
      <Badge variant={value ? "default" : "secondary"}>
        {value ? "Tenant" : "Global"}
      </Badge>
    ),
  },
  {
    key: "rights",
    label: "Permissions",
    hideable: true,
    render: (value) => {
      const rights = value ? (Array.isArray(value) ? value : []) : [];
      const count = rights.length;
      return (
        <div className="text-sm">
          {count > 0 ? (
            <Badge variant="outline">
              {count} permission{count === 1 ? "" : "s"}
            </Badge>
          ) : (
            <span className="text-muted-foreground">No permissions</span>
          )}
        </div>
      );
    },
    exportTransform: (value) => JSON.stringify(value || []),
  },
  {
    key: "created_at",
    label: "Created",
    sortable: true,
    hideable: true,
    render: (value) => (
      <div className="text-sm">{new Date(value).toLocaleDateString()}</div>
    ),
    exportTransform: (value) => new Date(value).toISOString(),
  },
];

const actions: DataTableAction<Data>[] = [
  {
    id: "view",
    label: "View Details",
    icon: <Eye className="h-4 w-4" />,
    onClick: async (rows) => {
      // Navigate to role detail page
      if (rows.length === 1) {
        window.open(`/roles/${rows[0].id}`, "_blank");
      }
    },
    disabled: (rows) => rows.length !== 1,
  },
  {
    id: "edit",
    label: "Edit Role",
    icon: <Edit className="h-4 w-4" />,
    onClick: async (rows) => {
      // Navigate to edit page or open modal
      if (rows.length === 1) {
        window.location.href = `/roles/${rows[0].id}/edit`;
      }
    },
    disabled: (rows) => rows.length !== 1,
  },
  {
    id: "clone",
    label: "Clone Role",
    icon: <Plus className="h-4 w-4" />,
    onClick: async (rows) => {
      if (rows.length === 1) {
        // TODO: Implement role cloning
        console.log("Cloning role:", rows[0].id);
      }
    },
    disabled: (rows) => rows.length !== 1,
  },
  {
    id: "delete",
    label: "Delete Roles",
    icon: <Trash2 className="h-4 w-4" />,
    variant: "destructive",
    disabled: (rows) => rows.length === 0 || rows.some((row) => !row.tenant_id),
    onClick: async (rows) => {
      const confirmed = confirm(
        `Are you sure you want to delete ${rows.length} role(s)? This action cannot be undone.`
      );
      if (confirmed) {
        // TODO: Implement role deletion
        console.log(
          "Deleting roles:",
          rows.map((r) => r.id)
        );
      }
    },
  },
];

// Define predefined views for common role filters
const views: DataTableView[] = [
  {
    id: "global-roles",
    name: "Global Roles",
    filters: [{ column: "tenant_id", operator: "is", value: "null" }],
    sorts: [{ column: "name", direction: "asc" }],
  },
  {
    id: "tenant-roles",
    name: "Tenant Roles",
    filters: [{ column: "tenant_id", operator: "neq", value: "null" }],
    sorts: [{ column: "created_at", direction: "desc" }],
  },
  {
    id: "recent-roles",
    name: "Recent Roles",
    filters: [],
    sorts: [{ column: "created_at", direction: "desc" }],
  },
];

export default function Roles() {
  const fetcher = async (
    params: DataTableFetchParams
  ): Promise<DataTableFetchResult<Data>> => {
    try {
      const result = await getRows("roles", {
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
        error: error instanceof Error ? error.message : "Failed to fetch roles",
      };
    }
  };

  return (
    <div className="container mx-auto py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Roles & Permissions</h1>
          <p className="text-muted-foreground">
            Manage system roles and their associated permissions
          </p>
        </div>
      </div>

      <DataTable
        columns={columns}
        fetcher={fetcher}
        actions={actions}
        views={views}
        initialFilters={[]}
        initialSort={[{ column: "name", direction: "asc" }]}
        enableSearch={true}
        searchPlaceholder="Search roles by name or description..."
        enableSelection={true}
        enableRefresh={true}
        enableExport={true}
        enableColumnToggle={true}
        emptyMessage="No roles found. Create your first role to get started."
        className="flex-1"
      />
    </div>
  );
}
