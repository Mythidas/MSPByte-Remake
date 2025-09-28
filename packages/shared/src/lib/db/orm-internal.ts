import { SupabaseClient } from "@supabase/supabase-js";
import {
  tablesSelectSingleGeneric,
  tablesSelectGeneric,
  tablesCountGeneric,
  tablesInsertGeneric,
  tablesUpdateGeneric,
  tablesUpsertGeneric,
  tablesDeleteGeneric,
} from "@workspace/shared/lib/db/generics.js";
import { Database } from "@workspace/shared/types/database/import.js";
import {
  TableOrView,
  GetRowConfig,
  GetRowCountConfig,
  Table,
  InsertRowConfig,
  UpdateRowConfig,
  UpsertRowConfig,
  DeleteRowConfig,
} from "@workspace/shared/types/database/index.js";

export async function internalGetRow<T extends TableOrView>(
  supabase: SupabaseClient<Database>,
  table: T,
  config?: GetRowConfig<T>
) {
  return tablesSelectSingleGeneric(
    supabase,
    table,
    (query) => {
      if (config && config.filters) {
        for (const filter of config.filters) {
          if (!filter) continue;

          let [col, op, val] = filter;
          if (op === "in" && Array.isArray(val)) {
            val = `(${val.join(",")})`;
          }

          query = query.filter(col as string, op, val);
        }
      }

      if (config && config.ors) {
        for (const or of config.ors) {
          if (!or) continue;

          let [first, second] = or;
          if (!first || !second) continue;

          query = query.or(
            `${first[0]}.${first[1]}.${first[2]},${second[0]}.${second[1]}.${second[2]}`
          );
        }
      }

      if (config && config.sorting) {
        for (const sorting of config.sorting) {
          if (!sorting) continue;
          const [col, dir] = sorting;

          query = query.order(col as string, { ascending: dir === "asc" });
        }
      }
    },
    config?.selects
  );
}

export async function internalGetRows<T extends TableOrView>(
  supabase: SupabaseClient<Database>,
  table: T,
  config?: GetRowConfig<T>
) {
  return tablesSelectGeneric(
    supabase,
    table,
    (query) => {
      if (config && config.filters) {
        for (const filter of config.filters) {
          if (!filter) continue;

          let [col, op, val] = filter;
          if (op === "in" || Array.isArray(val)) {
            val = `(${val.join(",")})`;
          }

          query = query.filter(col as string, op, val);
        }
      }

      if (config && config.ors) {
        for (const or of config.ors) {
          if (!or) continue;

          let [first, second] = or;
          if (!first || !second) continue;

          query = query.or(
            `${first[0]}.${first[1]}.${first[2]},${second[0]}.${second[1]}.${second[2]}`
          );
        }
      }

      if (config && config.sorting) {
        for (const sort of config.sorting) {
          if (!sort) continue;

          let [col, dir] = sort;
          query = query.order(col as string, { ascending: dir === "asc" });
        }
      }
    },
    config?.pagination,
    config?.selects
  );
}

export async function internalGetRowsCount<T extends TableOrView>(
  supabase: SupabaseClient<Database>,
  table: T,
  config?: GetRowCountConfig<T>
) {
  return tablesCountGeneric(supabase, table, (query) => {
    if (config && config.filters) {
      for (const filter of config.filters) {
        if (!filter) continue;

        let [col, op, val] = filter;
        if (op === "in" && Array.isArray(val)) {
          val = `(${val.join(",")})`;
        }

        query = query.filter(col as string, op, val);
      }
    }

    if (config && config.ors) {
      for (const or of config.ors) {
        if (!or) continue;

        let [first, second] = or;
        if (!first || !second) continue;

        query = query.or(
          `${first[0]}.${first[1]}.${first[2]},${second[0]}.${second[1]}.${second[2]}`
        );
      }
    }
  });
}

export async function internalInsertRows<T extends Table>(
  supabase: SupabaseClient<Database>,
  table: T,
  config: InsertRowConfig<T>
) {
  return tablesInsertGeneric(supabase, table, config.rows);
}

export async function internalUpdateRow<T extends Table>(
  supabase: SupabaseClient<Database>,
  table: T,
  config: UpdateRowConfig<T>
) {
  return tablesUpdateGeneric(supabase, table, config.id, config.row);
}

export async function internalUpsertRows<T extends Table>(
  supabase: SupabaseClient<Database>,
  table: T,
  config: UpsertRowConfig<T>
) {
  return tablesUpsertGeneric(
    supabase,
    table,
    config.rows,
    config.onConflict,
    (query) => {
      if (config.filters) {
        for (const filter of config.filters) {
          if (!filter) continue;

          let [col, op, val] = filter;
          if (op === "in" && Array.isArray(val)) {
            val = `(${val.join(",")})`;
          }

          query = query.filter(col as string, op, val);
        }
      }

      if (config && config.ors) {
        for (const or of config.ors) {
          if (!or) continue;

          let [first, second] = or;
          if (!first || !second) continue;

          query = query.or(
            `${first[0]}.${first[1]}.${first[2]},${second[0]}.${second[1]}.${second[2]}`
          );
        }
      }
    }
  );
}

export async function internalDeleteRows<T extends Table>(
  supabase: SupabaseClient<Database>,
  table: T,
  config: DeleteRowConfig<T>
) {
  return tablesDeleteGeneric(supabase, table, (query) => {
    for (const filter of config.filters) {
      if (!filter) continue;

      let [col, op, val] = filter;
      if (op === "in" && Array.isArray(val)) {
        val = `(${val.join(",")})`;
      }

      query = query.filter(col as string, op, val);
    }

    if (config && config.ors) {
      for (const or of config.ors) {
        if (!or) continue;

        let [first, second] = or;
        if (!first || !second) continue;

        query = query.or(
          `${first[0]}.${first[1]}.${first[2]},${second[0]}.${second[1]}.${second[2]}`
        );
      }
    }
  });
}
