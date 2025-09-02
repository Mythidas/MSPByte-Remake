"use client";

import { DataTable } from "@/components/DataTable/DataTable";
import fetchTableData from "@/lib/supabase/table-fetcher";
import { DataTableColumn, DataTableFetchParams } from "@/lib/types/datatable";
import { Badge } from "@workspace/ui/components/badge";
import { prettyText } from "@workspace/shared/lib/utils";
import { Tables } from "@workspace/shared/types/database";
import Link from "next/link";

type Data = Tables<"integrations">;

const columns: DataTableColumn<Data>[] = [
  {
    key: "name",
    label: "Name",
    sortable: true,
    filterable: true,
    render: (value, row) => (
      <Link
        className="font-medium hover:text-primary"
        href={`/integrations/${row.id}`}
      >
        {value}
      </Link>
    ),
  },
  {
    key: "description",
    label: "Description",
    sortable: true,
    filterable: true,
    filterType: "text",
  },
  {
    key: "category",
    label: "Category",
    sortable: true,
    filterable: true,
    filterType: "text",
  },
];

export default function Page() {
  const fetcher = async (params: DataTableFetchParams) => {
    return await fetchTableData<Data>("integrations", params);
  };

  return (
    <div className="grid gap-2">
      <div>
        <h1 className="text-2xl font-semibold">Integrations</h1>
      </div>
      <DataTable
        columns={columns}
        fetcher={fetcher}
        enableRefresh={true}
        useUrlState={true}
        urlStateKey="int"
      />
    </div>
  );
}
