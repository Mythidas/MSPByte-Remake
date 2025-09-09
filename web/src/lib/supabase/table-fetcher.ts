"use server";

import { getRows } from "@/lib/supabase/orm";
import { createClient } from "@/lib/supabase/server";
import { DataTableFetchResult } from "@/lib/types/datatable";
import {
  GetRowConfig,
  TableOrView,
  Tables,
} from "@workspace/shared/types/database";

export default async function fetchTableData<T extends TableOrView>(
  tableName: T,
  config: GetRowConfig<T>
): Promise<DataTableFetchResult<Tables<T>>> {
  const { data } = await getRows(tableName, config);

  if (data) {
    return {
      data: data.rows,
      count: data.total,
    };
  }

  return {
    data: [],
    count: 0,
  };
}
