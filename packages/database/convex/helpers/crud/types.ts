/**
 * Example usage documentation for the new dynamic CRUD system.
 * Uses TypeScript filtering to bypass Convex's limited database filters.
 *
 * See: packages/database/convex/helpers/dynamicCrud.ts
 *
 * The dynamic CRUD functions (dynamicList and dynamicGet) are exported from
 * dynamicCrud.ts and can be called directly from your frontend or used within
 * other Convex functions through the API.
 *
 * USAGE FROM FRONTEND:
 * ====================
 * import { api } from 'convex/_generated/api';
 *
 * // Example 1: Simple list with default by_tenant index
 * const sites = await client.query(api.helpers.dynamicCrud.dynamicList, {
 *   tableName: "sites",
 *   filters: {
 *     status: "active",
 *   },
 * });
 *
 * // Example 2: Custom index with complex filters
 * const agents = await client.query(api.helpers.dynamicCrud.dynamicList, {
 *   tableName: "agents",
 *   index: {
 *     name: "by_site",
 *     params: { siteId: "..." },
 *   },
 *   filters: {
 *     status: "online",
 *     platform: { in: ["windows", "linux"] },
 *   },
 * });
 *
 * // Example 3: Logical operators (AND, OR, NOT)
 * const jobs = await client.query(api.helpers.dynamicCrud.dynamicList, {
 *   tableName: "scheduled_jobs",
 *   filters: {
 *     or: [
 *       { status: "failed" },
 *       { status: "pending", attempts: { gte: 3 } },
 *     ],
 *   },
 * });
 *
 * // Example 4: String operations
 * const searchResults = await client.query(api.helpers.dynamicCrud.dynamicList, {
 *   tableName: "sites",
 *   filters: {
 *     name: { contains: "acme" },
 *     status: { ne: "archived" },
 *   },
 * });
 *
 * // Example 5: Complex nested conditions
 * const now = Date.now();
 * const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
 * const dataSources = await client.query(api.helpers.dynamicCrud.dynamicList, {
 *   tableName: "data_sources",
 *   filters: {
 *     and: [
 *       { status: "active" },
 *       {
 *         or: [
 *           { credentialExpirationAt: { lt: now + 7 * 24 * 60 * 60 * 1000 } },
 *           { lastSyncAt: { lt: sevenDaysAgo } },
 *           { lastSyncAt: undefined },
 *         ],
 *       },
 *     ],
 *   },
 * });
 *
 * // Example 6: Get single record with dynamicGet
 * const agent = await client.query(api.helpers.dynamicCrud.dynamicGet, {
 *   tableName: "agents",
 *   index: {
 *     name: "by_guid",
 *     params: { guid: "abc-123" },
 *   },
 *   filters: {
 *     status: { ne: "offline" },
 *   },
 * });
 *
 * SUPPORTED FILTER OPERATORS:
 * ============================
 *
 * Comparison: gt, gte, lt, lte, eq, ne
 * Arrays: in, nin, includes
 * Strings: contains, startsWith, endsWith, regex
 * Logical: and, or, not
 *
 * BENEFITS:
 * =========
 * ✅ Single function queries ANY table
 * ✅ Unlimited filter complexity
 * ✅ Index-first approach for performance
 * ✅ Automatic tenant isolation
 * ✅ Type-safe table names
 * ✅ No schema changes required
 */

import { v } from "convex/values";
import { DataModel, Doc, Id } from "../../_generated/dataModel.js";

export const TableName = v.union(
  v.literal("users"),
  v.literal("roles"),
  v.literal("entities"),
  v.literal("agents"),
  v.literal("data_sources"),
  v.literal("integrations"),
  v.literal("scheduled_jobs"),
  v.literal("sites")
);

/**
 * Comparison operators for numeric and string values
 */
export type ComparisonOperators<T> = {
  gt?: T;
  gte?: T;
  lt?: T;
  lte?: T;
  eq?: T;
  ne?: T;
};

/**
 * Array operators
 */
export type ArrayOperators<T> = {
  in?: T[];
  nin?: T[];
  includes?: T extends Array<infer U> ? U : never;
};

/**
 * String operators
 */
export type StringOperators = {
  contains?: string;
  startsWith?: string;
  endsWith?: string;
  regex?: RegExp;
};

/**
 * Field-level filter that can be a direct value or operators
 */
export type FieldFilter<T> = T extends string
  ? T | ComparisonOperators<T> | StringOperators | ArrayOperators<T>
  : T extends number
    ? T | ComparisonOperators<T> | ArrayOperators<T>
    : T extends boolean
      ? T | { eq?: T; ne?: T }
      : T | ComparisonOperators<T> | ArrayOperators<T>;

/**
 * Logical operators for combining filters
 */
export type LogicalOperators<T> = {
  and?: FilterConditions<T>[];
  or?: FilterConditions<T>[];
  not?: FilterConditions<T>;
};

/**
 * Filter conditions for a record type
 * Can specify field filters and logical operators
 */
export type FilterConditions<T> = {
  [K in keyof T]?: FieldFilter<T[K]>;
} & LogicalOperators<T>;

/**
 * Public filter type (optional, can be undefined)
 */
export type DynamicFilter<T> = FilterConditions<T> | undefined;

// ============================================================================
// FILTER EVALUATION ENGINE
// ============================================================================

/**
 * Evaluates a single field filter against a value
 */
export function evaluateFieldFilter<T>(
  value: T,
  filter: FieldFilter<T>
): boolean {
  // Direct value comparison
  if (value === undefined && filter === null) return true;
  if (
    typeof filter !== "object" ||
    filter === null ||
    filter instanceof Date ||
    filter instanceof RegExp
  ) {
    return value === filter;
  }

  const operators = filter as Record<string, any>;

  // Comparison operators
  if ("gt" in operators && !(value > operators.gt)) return false;
  if ("gte" in operators && !(value >= operators.gte)) return false;
  if ("lt" in operators && !(value < operators.lt)) return false;
  if ("lte" in operators && !(value <= operators.lte)) return false;
  if ("eq" in operators && value !== operators.eq) return false;
  if ("ne" in operators && value === operators.ne) return false;

  // Array operators
  if ("in" in operators && !operators.in.includes(value)) return false;
  if ("nin" in operators && operators.nin.includes(value)) return false;
  if (
    "includes" in operators &&
    (!Array.isArray(value) || !value.includes(operators.includes))
  )
    return false;

  // String operators
  if (typeof value === "string") {
    if (
      "contains" in operators &&
      !value
        .toLowerCase()
        .includes((operators.contains as string).toLowerCase())
    )
      return false;
    if (
      "startsWith" in operators &&
      !value.startsWith(operators.startsWith as string)
    )
      return false;
    if (
      "endsWith" in operators &&
      !value.endsWith(operators.endsWith as string)
    )
      return false;
    if ("regex" in operators && !operators.regex.test(value)) return false;
  }

  return true;
}

/**
 * Evaluates filter conditions against a record
 * Supports nested logical operators (and, or, not)
 */
export function evaluateFilter<T extends Record<string, any>>(
  record: T,
  filter: FilterConditions<T> | undefined
): boolean {
  if (!filter) return true;

  // Handle logical operators
  if ("and" in filter && filter.and) {
    return filter.and.every((subFilter) => evaluateFilter(record, subFilter));
  }

  if ("or" in filter && filter.or) {
    return filter.or.some((subFilter) => evaluateFilter(record, subFilter));
  }

  if ("not" in filter && filter.not) {
    return !evaluateFilter(record, filter.not);
  }

  // Handle field-level filters
  for (const [key, fieldFilter] of Object.entries(filter)) {
    // Skip logical operators (already handled)
    if (key === "and" || key === "or" || key === "not") continue;

    const value = record[key];
    if (!evaluateFieldFilter(value, fieldFilter)) {
      return false;
    }
  }

  return true;
}

// ============================================================================
// UNIVERSAL LIST QUERY
// ============================================================================

/**
 * Configuration for index-based querying
 */
export type IndexConfig = {
  name: string;
  params: Record<string, any>;
};

/**
 * Arguments for dynamic list query
 */
export type DynamicListArgs<TableName extends keyof DataModel> = {
  tableName: TableName;
  index?: IndexConfig;
  filters?: DynamicFilter<Doc<TableName>>;
  includeSoftDeleted?: boolean;
};

// ============================================================================
// MUTATION RESULT TYPES
// ============================================================================

/**
 * Type-safe list result - returns array of documents for the specified table
 */
export type ListResult<TableName extends keyof DataModel> = Doc<TableName>[];

/**
 * Type-safe get result - returns single document or null for the specified table
 */
export type GetResult<TableName extends keyof DataModel> = Doc<TableName> | null;

/**
 * Type-safe insert result - returns array of IDs for successfully inserted records
 * Throws error if any insertion fails (atomic transaction)
 */
export type InsertResult<TableName extends keyof DataModel> = Id<TableName>[];

/**
 * Type-safe update result - returns array of IDs for successfully updated records
 * Throws error if any update fails (atomic transaction)
 */
export type UpdateResult<TableName extends keyof DataModel> = Id<TableName>[];

/**
 * Type-safe remove result - returns array of IDs for successfully deleted records
 * Throws error if any deletion fails (atomic transaction)
 */
export type RemoveResult<TableName extends keyof DataModel> = Id<TableName>[];
