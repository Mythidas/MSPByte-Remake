"use server";

import {
  tablesSelectSingleGeneric,
  tablesSelectGeneric,
  tablesCountGeneric,
  tablesInsertGeneric,
  tablesUpdateGeneric,
  tablesUpsertGeneric,
  tablesDeleteGeneric,
} from "@workspace/shared/lib/db/generics";
import {
  TableOrView,
  GetRowConfig,
  GetRowCountConfig,
  Table,
  InsertRowConfig,
  UpdateRowConfig,
  UpsertRowConfig,
  DeleteRowConfig,
} from "@workspace/shared/types/database";

export async function getRow<T extends TableOrView>(
  table: T,
  config?: GetRowConfig<T>
) {
  return tablesSelectSingleGeneric(
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

export async function getRows<T extends TableOrView>(
  table: T,
  config?: GetRowConfig<T>
) {
  return tablesSelectGeneric(
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

export async function getRowsCount<T extends TableOrView>(
  table: T,
  config?: GetRowCountConfig<T>
) {
  return tablesCountGeneric(table, (query) => {
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

export async function insertRows<T extends Table>(
  table: T,
  config: InsertRowConfig<T>
) {
  return tablesInsertGeneric(table, config.rows);
}

export async function updateRow<T extends Table>(
  table: T,
  config: UpdateRowConfig<T>
) {
  return tablesUpdateGeneric(table, config.id, config.row);
}

export async function upsertRows<T extends Table>(
  table: T,
  config: UpsertRowConfig<T>
) {
  return tablesUpsertGeneric(table, config.rows, (query) => {
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
  });
}

export async function deleteRows<T extends Table>(
  table: T,
  config: DeleteRowConfig<T>
) {
  return tablesDeleteGeneric(table, (query) => {
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
