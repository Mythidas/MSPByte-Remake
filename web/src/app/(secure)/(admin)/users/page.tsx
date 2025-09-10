"use client";

import { DataTable } from "@/components/DataTable/DataTable";
import fetchTableData from "@/lib/supabase/table-fetcher";
import {
  DataTableColumn,
  DataTableAction,
  DataTableFetchParams,
} from "@/lib/types/datatable";
import { Badge } from "@/components/ui/badge";
import { Eye, Edit, Trash2 } from "lucide-react";
import { prettyText } from "@workspace/shared/lib/utils";
import { Tables } from "@workspace/shared/types/database";

type Data = Tables<"users_with_role">;

const columns: DataTableColumn<Data>[] = [
  {
    key: "name",
    label: "Name",
    sortable: true,
    filterable: true,
    render: (value) => <div className="font-medium">{value}</div>,
  },
  {
    key: "email",
    label: "Email",
    sortable: true,
    filterable: true,
    filterType: "text",
  },
  {
    key: "role_name",
    label: "Role",
    sortable: true,
    filterable: true,
    filterType: "text",
  },
  {
    key: "status",
    label: "Status",
    sortable: true,
    filterable: true,
    filterType: "select",
    filterOptions: [
      { label: "Active", value: "active" },
      { label: "Inactive", value: "inactive" },
    ],
    render: (value) => (
      <Badge variant={value === "active" ? "default" : "secondary"}>
        {prettyText(value as string)}
      </Badge>
    ),
  },
  {
    key: "last_activity_at",
    label: "Last Active",
    sortable: true,
    render: (value) => (
      <div>{value ? new Date(value).toLocaleDateString() : "Never"}</div>
    ),
    exportTransform: (value) => new Date(value).toISOString(),
  },
  {
    key: "created_at",
    label: "Created",
    sortable: true,
    render: (value) => new Date(value).toLocaleDateString(),
    exportTransform: (value) => new Date(value).toISOString(),
  },
];

const actions: DataTableAction<Data>[] = [
  {
    id: "view",
    label: "View Details",
    icon: <Eye className="h-4 w-4" />,
    onClick: async (rows) => {
      console.log("Viewing:", rows);
    },
  },
  {
    id: "edit",
    label: "Edit",
    icon: <Edit className="h-4 w-4" />,
    onClick: async (rows) => {
      console.log("Editing:", rows);
    },
  },
  {
    id: "delete",
    label: "Delete",
    icon: <Trash2 className="h-4 w-4" />,
    variant: "destructive",
    disabled: (rows) => rows.some((row) => row.status === "active"),
    onClick: async (rows) => {
      console.log("Deleting:", rows);
    },
  },
];

export default function Users() {
  const fetcher = async (params: DataTableFetchParams) => {
    return await fetchTableData("users_with_role", {
      pagination: params,
    });
  };

  return (
    <div className="grid gap-2">
      <div>
        <h1 className="text-2xl font-semibold">Users</h1>
      </div>
      <DataTable
        columns={columns}
        fetcher={fetcher}
        actions={actions}
        enableSelection={true}
        enableRefresh={true}
        enableExport={true}
        enableColumnToggle={true}
        useUrlState={true}
        urlStateKey="users"
        onRowClick={(user) => {
          console.log("Row clicked:", user);
        }}
      />
    </div>
  );
}
