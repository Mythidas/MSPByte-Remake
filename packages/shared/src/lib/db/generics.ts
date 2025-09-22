import { PostgrestFilterBuilder } from "@supabase/postgrest-js";
import { SupabaseClient } from "@supabase/supabase-js";
import Debug from "@workspace/shared/lib/Debug";
import { APIResponse } from "@workspace/shared/types/api";
import {
  TableOrView,
  PaginationOptions,
  Row,
  DataResponse,
  Tables,
  Filters,
  Table,
  TablesInsert,
  TablesUpdate,
} from "@workspace/shared/types/database";
import { Database } from "@workspace/shared/types/database/import";

type RowType<T extends TableOrView> =
  T extends keyof Database["public"]["Tables"]
    ? Database["public"]["Tables"][T]["Row"]
    : T extends keyof Database["views"]["Views"]
      ? Database["views"]["Views"][T]["Row"]
      : never;
type QueryBuilder<T extends TableOrView> = PostgrestFilterBuilder<
  {},
  Database["public"],
  RowType<T>,
  RowType<T>
>;

const isView = <T extends TableOrView>(table: T) => {
  return table.includes("_view");
};
const getSchema = <T extends TableOrView>(table: T): "public" | "views" => {
  return isView(table) ? "views" : "public";
};

export async function tablesCountGeneric<T extends TableOrView>(
  supabase: SupabaseClient,
  table: T,
  modifyQuery?: (query: QueryBuilder<T>) => void
): Promise<APIResponse<number>> {
  try {
    let query = supabase
      .schema(getSchema(table))
      .from(table as any)
      .select("*", { count: "exact", head: true }); // head = no rows, just headers/meta

    if (modifyQuery) {
      modifyQuery(query as any);
    }

    const { count, error } = await query;

    if (error) throw new Error(error.message);

    return {
      data: count ?? 0,
      error: undefined,
    };
  } catch (err) {
    return Debug.error({
      module: "supabase",
      context: `count_${String(table)}`,
      message: String(err),
      code: "DB_FAILURE",
    });
  }
}

export async function tablesSelectGeneric<T extends TableOrView>(
  supabase: SupabaseClient,
  table: T,
  modifyQuery?: (query: QueryBuilder<T>) => void,
  pagination?: PaginationOptions,
  selects?: Array<Row<T>>
): Promise<APIResponse<DataResponse<Tables<T>>>> {
  if (pagination)
    return tablesSelectPaginated(
      supabase,
      table,
      pagination,
      modifyQuery,
      selects
    );

  try {
    let query = supabase
      .schema(getSchema(table))
      .from(table as any)
      .select(selects ? selects.join(",") : "*");

    if (modifyQuery) {
      modifyQuery(query as any);
    }

    let results = [];

    while (true) {
      const { data, error } = await query.range(
        results.length,
        results.length + 999
      );

      if (error) throw new Error(error.message);

      results.push(...(data ?? []));
      if (!data || data.length < 1000) break;
    }

    return {
      data: {
        rows: results as Tables<T>[],
        total: results.length,
      } as DataResponse<Tables<T>>,
    };
  } catch (err) {
    return Debug.error({
      module: "supabase",
      context: `select_${String(table)}`,
      message: String(err),
      code: "DB_FAILURE",
    });
  }
}

export async function tablesSelectPaginated<T extends TableOrView>(
  supabase: SupabaseClient,
  table: T,
  pagination: PaginationOptions,
  modifyQuery?: (query: QueryBuilder<T>) => void,
  selects?: Array<Row<T>>
): Promise<APIResponse<DataResponse<Tables<T>>>> {
  try {
    const from = pagination.page * pagination.size;
    const to = from + pagination.size - 1;

    let query = supabase
      .schema(getSchema(table))
      .from(table as any)
      .select(selects ? selects.join(",") : "*", { count: "exact" }) // includes count in response
      .range(from, to);

    if (pagination.filters) {
      paginatedFilters(query as any, pagination.filters, pagination.filterMap);
    }

    if (pagination.globalFields && pagination.globalSearch) {
      const value = `%${pagination.globalSearch}%`;
      query = query.or(
        pagination.globalFields.map((col) => `${col}.ilike.${value}`).join(",")
      );
    }

    if (pagination.sorting && Object.entries(pagination.sorting).length) {
      const [key, value] = Object.entries(pagination.sorting)[0]!;
      const keyMap = pagination.filterMap
        ? (pagination.filterMap[key] ?? key)
        : key;
      query = query.order(keyMap, { ascending: value === "asc" });
    }

    if (modifyQuery) {
      modifyQuery(query as any);
    }

    const { data, count, error } = await query;

    if (error) throw new Error(error.message);

    return {
      data: {
        rows: (data as Tables<T>[]) ?? [],
        total: count ?? 0,
      },
    };
  } catch (err) {
    return Debug.error({
      module: "supabase",
      context: `paginated_${String(table)}`,
      message: String(err),
      code: "DB_FAILURE",
    });
  }
}

export function paginatedFilters<T extends TableOrView>(
  query: QueryBuilder<T>,
  filters: Filters,
  map?: Record<string, string>
): QueryBuilder<T> {
  for (let [key, { op, value }] of Object.entries(filters)) {
    if (value === undefined || value === null || value === "") continue;

    const column = map ? (map[key] ?? key) : key;

    switch (op) {
      case "eq":
      case "neq":
      case "is":
      case "not.neq":
      case "not.eq":
      case "not.is":
        query = query.filter(column as string, op, value);
        break;
      case "like":
      case "ilike":
      case "not.like":
      case "not.ilike":
        query = query.filter(column as string, op, `%${value}%`);
        break;

      case "gte":
      case "lte":
      case "gt":
      case "lt":
      case "not.gte":
      case "not.lte":
      case "not.gt":
      case "not.lt":
        query = query.filter(column as string, op, value);
        break;

      case "ov":
      case "cd":
      case "cs":
      case "not.ov":
      case "not.cd":
      case "not.cs":
        if (!Array.isArray(value)) {
          value = `{"${value}"}`;
        } else {
          value = `{${value.join(",")}}`;
        }

        query = query.filter(column as string, op, value);
        break;

      case "in":
      case "not.in":
        if (!Array.isArray(value)) {
          value = `("${value}")`;
        } else {
          value = `(${value.join(",")})`;
        }

        query = query.filter(column as string, op, value);
        break;

      case "bt":
        if (Array.isArray(value)) {
          query = query
            .gte(column as any, value[0])
            .lte(column as any, value[1]);
        }
        break;
      default:
        throw new Error(`Unsupported operator: ${op}`);
    }
  }

  return query;
}

export async function tablesSelectSingleGeneric<T extends TableOrView>(
  supabase: SupabaseClient,
  table: T,
  modifyQuery?: (query: QueryBuilder<T>) => void,
  selects?: Array<Row<T>>
): Promise<APIResponse<Tables<T>>> {
  try {
    let query = supabase
      .schema(getSchema(table))
      .from(table as any)
      .select(selects ? selects.join(",") : "*")
      .limit(1);

    if (modifyQuery) {
      modifyQuery(query as any);
    }

    const { data, error } = await query.single();
    if (error) throw new Error(error.message);

    return {
      data: data as Tables<T>,
    };
  } catch (err) {
    return Debug.error({
      module: "supabase",
      context: `select_${String(table)}`,
      message: String(err),
      code: "DB_FAILURE",
    });
  }
}

export async function tablesInsertGeneric<T extends Table>(
  supabase: SupabaseClient,
  table: T,
  rows: TablesInsert<T>[],
  modifyQuery?: (query: QueryBuilder<T>) => void
): Promise<APIResponse<Tables<T>[]>> {
  try {
    let query = supabase.schema(getSchema(table)).from(table as any);

    if (modifyQuery) {
      modifyQuery(query as any);
    }

    const { data, error } = await query.insert(rows as any).select();
    if (error) throw new Error(error.message);

    return {
      data: data as Tables<T>[],
    };
  } catch (err) {
    return Debug.error({
      module: "supabase",
      context: `insert_${String(table)}`,
      message: String(err),
      code: "DB_FAILURE",
    });
  }
}

export async function tablesUpdateGeneric<T extends Table>(
  supabase: SupabaseClient,
  table: T,
  id: string,
  row: TablesUpdate<T>
): Promise<APIResponse<Tables<T>>> {
  try {
    const { data, error } = await supabase
      .schema(getSchema(table))
      .from(table as any)
      .update(row as any)
      .eq("id", id as any)
      .select()
      .single();

    if (error) throw new Error(error.message);

    return {
      data: data as Tables<T>,
    };
  } catch (err) {
    return Debug.error({
      module: "supabase",
      context: `update_${String(table)}`,
      message: String(err),
      code: "DB_FAILURE",
    });
  }
}

export async function tablesUpsertGeneric<T extends Table>(
  supabase: SupabaseClient,
  table: T,
  rows: (TablesUpdate<T> | TablesInsert<T>)[],
  modifyQuery?: (query: QueryBuilder<T>) => void
): Promise<APIResponse<Tables<T>[]>> {
  try {
    let query = supabase
      .schema(getSchema(table))
      .from(table as any)
      .upsert(rows as any);

    if (modifyQuery) {
      modifyQuery(query as any);
    }

    const { data, error } = await query.select();
    if (error) throw new Error(error.message);

    return {
      data: data as Tables<T>[],
    };
  } catch (err) {
    return Debug.error({
      module: "supabase",
      context: `upsert_${String(table)}`,
      message: String(err),
      code: "DB_FAILURE",
    });
  }
}

export async function tablesDeleteGeneric<T extends Table>(
  supabase: SupabaseClient,
  table: T,
  modifyQuery?: (query: QueryBuilder<T>) => void
): Promise<APIResponse<null>> {
  try {
    let query = supabase
      .schema(getSchema(table))
      .from(table as any)
      .delete();

    if (modifyQuery) {
      modifyQuery(query as any);
    }

    const { error } = await query.select();
    if (error) throw new Error(error.message);

    return {
      data: null,
    };
  } catch (err) {
    return Debug.error({
      module: "supabase",
      context: `delete_${String(table)}`,
      message: String(err),
      code: "DB_FAILURE",
    });
  }
}
