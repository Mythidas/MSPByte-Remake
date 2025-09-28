import { Database } from "@workspace/shared/types/database/import.js";

// types.ts
export type Table = keyof Database["public"]["Tables"];
export type View = keyof Database["views"]["Views"];
export type TableOrView = Table | View;
export type Tables<T extends TableOrView> = T extends Table
  ? Database["public"]["Tables"][T] extends { Row: infer R }
    ? R
    : never
  : T extends View
    ? Database["views"]["Views"][T] extends { Row: infer R }
      ? R
      : never
    : never;

export type Row<T extends TableOrView> = T extends Table
  ? Database["public"]["Tables"][T] extends { Row: infer R }
    ? keyof R
    : undefined
  : T extends View
    ? Database["views"]["Views"][T] extends { Row: infer R }
      ? keyof R
      : undefined
    : undefined;
export type RowFilter<T extends TableOrView> = T extends Table
  ? Database["public"]["Tables"][T] extends { Row: infer R }
    ?
        | [column: Row<T> | (string & {}), operator: Operations, value: any]
        | undefined
    : undefined
  : T extends View
    ? Database["views"]["Views"][T] extends { Row: infer R }
      ?
          | [column: keyof R | (string & {}), operator: Operations, value: any]
          | undefined
      : undefined
    : undefined;
export type RowSort<T extends TableOrView> = T extends Table
  ? Database["public"]["Tables"][T] extends { Row: infer R }
    ? [column: keyof R | (string & {}), order: "asc" | "desc"] | undefined
    : undefined
  : T extends View
    ? Database["views"]["Views"][T] extends { Row: infer R }
      ? [column: keyof R | (string & {}), order: "asc" | "desc"] | undefined
      : undefined
    : undefined;

export type TablesInsert<T extends Table> = T extends Table
  ? Database["public"]["Tables"][T] extends { Insert: infer R }
    ? R
    : never
  : never;
export type TablesUpdate<T extends Table> = T extends Table
  ? Database["public"]["Tables"][T] extends { Update: infer R }
    ? R
    : never
  : never;

export type Operations =
  | "eq" // equal to (e.g., column=eq.value)
  | "neq" // not equal to
  | "gt" // greater than
  | "gte" // greater than or equal to
  | "lt" // less than
  | "lte" // less than or equal to
  | "like" // LIKE pattern match (case-sensitive, `%` as wildcard)
  | "ilike" // ILIKE pattern match (case-insensitive)
  | "is" // IS operator (commonly used with NULL, e.g., column=is.null)
  | "in" // matches any in a comma-separated list (e.g., id=in.(1,2,3))
  | "cs" // contains — array contains value(s)
  | "cd" // contained in — array is contained by value(s)
  | "ov" // overlaps
  | "not.ov"
  | "not.eq" // equal to (e.g., column=eq.value)
  | "not.neq" // not equal to
  | "not.gt" // greater than
  | "not.gte" // greater than or equal to
  | "not.lt" // less than
  | "not.lte" // less than or equal to
  | "not.like" // LIKE pattern match (case-sensitive, `%` as wildcard)
  | "not.ilike" // ILIKE pattern match (case-insensitive)
  | "not.is" // IS operator (commonly used with NULL, e.g., column=is.null)
  | "not.in" // matches any in a comma-separated list (e.g., id=in.(1,2,3))
  | "not.cs" // contains — array contains value(s)
  | "not.cd"; // contained in — array is contained by value(s)

export type DataResponse<T> = {
  rows: T[];
  total: number;
};

export type FilterOperations = Operations | "bt";
export type FilterType =
  | "text"
  | "select"
  | "boolean"
  | "date"
  | "number"
  | "multiselect";

export type FilterPrimitive = string | number | boolean | string[] | undefined;
export type FilterPrimitiveTuple = [FilterPrimitive, FilterPrimitive];
export type FilterValue =
  | { op: Exclude<FilterOperations, "bt">; value: FilterPrimitive | undefined }
  | { op: "bt"; value: FilterPrimitiveTuple };
export type Filters = Record<string, FilterValue>;

export type PaginationOptions = {
  page: number;
  size: number;
  filters?: Filters;
  globalFields?: string[];
  globalSearch?: string;
  filterMap?: Record<string, string>;
  sorting?: Record<string, "asc" | "desc">;
};

export type GetRowConfig<T extends TableOrView> = {
  filters?: Array<RowFilter<T> | undefined>;
  ors?: Array<[RowFilter<T>, RowFilter<T>] | undefined>;
  selects?: Array<Row<T>>;
  sorting?: Array<RowSort<T> | undefined>;
  pagination?: PaginationOptions;
};

export type GetRowCountConfig<T extends TableOrView> = {
  filters?: Array<RowFilter<T> | undefined>;
  ors?: Array<[RowFilter<T>, RowFilter<T>] | undefined>;
};

export type InsertRowConfig<T extends Table> = {
  rows: TablesInsert<T>[];
};

export type UpdateRowConfig<T extends Table> = {
  id: string;
  row: TablesUpdate<T>;
};

export type UpsertRowConfig<T extends Table> = {
  rows: (TablesUpdate<T> | TablesInsert<T>)[];
  onConflict: Row<T>[];
  filters?: Array<RowFilter<T> | undefined>;
  ors?: Array<[RowFilter<T>, RowFilter<T>] | undefined>;
};

export type DeleteRowConfig<T extends Table> = {
  filters: Array<RowFilter<T> | undefined>;
  ors?: Array<[RowFilter<T>, RowFilter<T>] | undefined>;
};
