"use server";

import { createClient } from "@/lib/supabase/server";
import {
  DataTableFetchParams,
  DataTableFetchResult,
} from "@/lib/types/datatable";
import { TableOrView } from "@workspace/shared/types/database";

export default async function fetchTableData<T>(
  tableName: TableOrView,
  params: DataTableFetchParams
): Promise<DataTableFetchResult<T>> {
  try {
    const supabase = await createClient();

    let query = supabase.from(tableName as any).select("*", { count: "exact" });

    // Apply filters
    for (const filter of params.filters) {
      if (filter.jsonbPath) {
        // Handle JSONB path queries
        query = query.filter(
          filter.column,
          filter.operator,
          `"${filter.jsonbPath}"->"${filter.value}"`
        );
      } else {
        switch (filter.operator) {
          case "eq":
            query = query.eq(filter.column, filter.value);
            break;
          case "neq":
            query = query.neq(filter.column, filter.value);
            break;
          case "gt":
            query = query.gt(filter.column, filter.value);
            break;
          case "gte":
            query = query.gte(filter.column, filter.value);
            break;
          case "lt":
            query = query.lt(filter.column, filter.value);
            break;
          case "lte":
            query = query.lte(filter.column, filter.value);
            break;
          case "like":
            query = query.like(filter.column, filter.value);
            break;
          case "ilike":
            query = query.ilike(filter.column, filter.value);
            break;
          case "in":
            query = query.in(
              filter.column,
              filter.value as any as readonly any[]
            );
            break;
          case "is":
            query = query.is(filter.column, filter.value);
            break;
        }
      }
    }

    // Apply sorting
    for (const sort of params.sorts) {
      if (sort.jsonbPath) {
        query = query.order(`${sort.column}->>'${sort.jsonbPath}'`, {
          ascending: sort.direction === "asc",
        });
      } else {
        query = query.order(sort.column, {
          ascending: sort.direction === "asc",
        });
      }
    }

    // Apply pagination
    const from = (params.page - 1) * params.pageSize;
    const to = from + params.pageSize - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      return { data: [], count: 0, error: error.message };
    }
    return { data: (data as T[]) || [], count: count || 0 };
  } catch (error) {
    return {
      data: [],
      count: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
