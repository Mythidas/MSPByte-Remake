"use client";

import { DataTable } from "@/components/DataTable/DataTable";
import fetchTableData from "@/lib/supabase/table-fetcher";
import { DataTableColumn, DataTableFetchParams } from "@/lib/types/datatable";
import { Badge } from "@/components/ui/badge";
import { prettyText } from "@workspace/shared/lib/utils";
import { Tables } from "@workspace/shared/types/database";
import Link from "next/link";

type Data = Tables<"sites_view">;

const columns: DataTableColumn<Data>[] = [
  {
    key: "name",
    label: "Name",
    sortable: true,
    filterable: true,
    searchable: true,
    render: (value, row) => (
      <Link
        href={`/sites/${row.slug}`}
        className="font-medium hover:text-primary"
      >
        {value}
      </Link>
    ),
  },
  {
    key: "parent_name",
    label: "Parent",
    sortable: true,
    filterable: true,
    searchable: true,
    render: (value, row) => (
      <Link
        href={`/sites/${row.parent_slug}`}
        className="font-medium hover:text-primary"
      >
        {value}
      </Link>
    ),
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
];

export default function Page() {
  const fetcher = async (params: DataTableFetchParams) => {
    return await fetchTableData<Data>("sites_view", params);
  };

  return (
    <div className="grid gap-2 p-4">
      <div>
        <h1 className="text-2xl font-semibold">Sites</h1>
      </div>
      <DataTable
        columns={columns}
        fetcher={fetcher}
        initialSort={[{ column: "name", direction: "asc" }]}
        enableRefresh={true}
        enableExport={true}
        enableColumnToggle={true}
        useUrlState={true}
        urlStateKey="sites"
      />
    </div>
  );
}
