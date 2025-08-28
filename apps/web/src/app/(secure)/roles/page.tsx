"use client";

import { DataTable } from "@/components/DataTable/DataTable";
import fetchTableData from "@/lib/supabase/table-fetcher";
import {
  DataTableColumn,
  DataTableAction,
  DataTableFetchParams,
} from "@/lib/types/datatable";
import { Eye, Edit, Trash2 } from "lucide-react";
import { Tables } from "@workspace/shared/types/database";

type Data = Tables<"roles">;

const columns: DataTableColumn<Data>[] = [
  {
    key: "name",
    label: "Name",
    sortable: true,
    filterable: true,
    render: (value) => <div className="font-medium">{value}</div>,
  },
  {
    key: "description",
    label: "Description",
    sortable: true,
    filterable: true,
    filterType: "text",
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
    disabled: (rows) => rows.some((r) => !r.tenant_id),
    onClick: async (rows) => {
      console.log("Deleting:", rows);
    },
  },
];

export default function Roles() {
  const fetcher = async (params: DataTableFetchParams) => {
    return await fetchTableData<Data>("roles", params);
  };

  return (
    <div className="grid gap-2">
      <div>
        <h1 className="text-2xl font-semibold">Roles</h1>
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
        urlStateKey="roles"
      />
    </div>
  );
}
