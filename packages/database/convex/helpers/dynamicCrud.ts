import { v } from "convex/values";
import { query } from "../_generated/server.js";
import { isAuthenticated } from "./validators.js";
import type { DataModel, Doc } from "../_generated/dataModel.js";
import { filter } from "convex-helpers/server/filter";

/**
 * Dynamic CRUD system using TypeScript filtering to bypass Convex's limited filters.
 * Based on: https://stack.convex.dev/complex-filters-in-convex
 *
 * Key Features:
 * - Query ANY table with a single function
 * - Index-first approach for performance (defaults to by_tenant)
 * - Automatic tenant isolation
 * - Unlimited filtering complexity via TypeScript
 * - Type-safe table names
 *
 * @example
 * // Simple query with default by_tenant index
 * dynamicList({
 *   tableName: "sites",
 *   filters: { status: "active" }
 * })
 *
 * @example
 * // Query with custom index and complex filters
 * dynamicList({
 *   tableName: "agents",
 *   index: "by_site",
 *   indexParams: { siteId: "..." },
 *   filters: {
 *     status: "online",
 *     platform: { in: ["windows", "linux"] },
 *     version: { gte: "2.0.0" }
 *   }
 * })
 */

// ============================================================================
// FILTER TYPE DEFINITIONS
// ============================================================================

/**
 * Comparison operators for numeric and string values
 */
type ComparisonOperators<T> = {
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
type ArrayOperators<T> = {
  in?: T[];
  nin?: T[];
  includes?: T extends Array<infer U> ? U : never;
};

/**
 * String operators
 */
type StringOperators = {
  contains?: string;
  startsWith?: string;
  endsWith?: string;
  regex?: RegExp;
};

/**
 * Field-level filter that can be a direct value or operators
 */
type FieldFilter<T> = T extends string
  ? T | ComparisonOperators<T> | StringOperators | ArrayOperators<T>
  : T extends number
    ? T | ComparisonOperators<T> | ArrayOperators<T>
    : T extends boolean
      ? T | { eq?: T; ne?: T }
      : T | ComparisonOperators<T> | ArrayOperators<T>;

/**
 * Logical operators for combining filters
 */
type LogicalOperators<T> = {
  and?: FilterConditions<T>[];
  or?: FilterConditions<T>[];
  not?: FilterConditions<T>;
};

/**
 * Filter conditions for a record type
 * Can specify field filters and logical operators
 */
type FilterConditions<T> = {
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
function evaluateFieldFilter<T>(value: T, filter: FieldFilter<T>): boolean {
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
function evaluateFilter<T extends Record<string, any>>(
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
type IndexConfig = {
  name: string;
  params: Record<string, any>;
};

/**
 * Arguments for dynamic list query
 */
type DynamicListArgs<TableName extends keyof DataModel> = {
  tableName: TableName;
  index?: IndexConfig;
  filters?: DynamicFilter<Doc<TableName>>;
  includeSoftDeleted?: boolean;
};

/**
 * Universal list query that works with ANY table
 *
 * Strategy:
 * 1. Use specified index (or default to by_tenant) to narrow results
 * 2. Always inject tenantId for tenant isolation
 * 3. Collect all matching records from index
 * 4. Apply TypeScript filters for complex conditions
 * 5. Filter out soft-deleted records (unless specified)
 *
 * @param tableName - Name of the table to query
 * @param index - Optional index configuration { name, params }
 * @param filters - TypeScript filter object for complex conditions
 * @param includeSoftDeleted - Include soft-deleted records (default: false)
 */
export const dynamicList = query({
  args: {
    tableName: v.string(),
    index: v.optional(
      v.object({
        name: v.string(),
        params: v.any(),
      })
    ),
    filters: v.optional(v.any()),
    includeSoftDeleted: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await isAuthenticated(ctx);
    const {
      tableName,
      index,
      filters,
      includeSoftDeleted = false,
    } = args as DynamicListArgs<keyof DataModel>;

    // Step 1: Start with index query
    let queryBuilder: any;

    if (index) {
      // Use custom index with provided params + tenantId
      queryBuilder = ctx.db
        .query(tableName)
        .withIndex(index.name as any, (q: any) => {
          let filtered = q;

          // Apply index params in order
          for (const [field, value] of Object.entries(index.params)) {
            filtered = filtered.eq(field, value);
          }

          // Always add tenantId for tenant isolation
          filtered = filtered.eq("tenantId", identity.tenantId);

          return filtered;
        });
    } else {
      // Default to by_tenant index
      queryBuilder = ctx.db
        .query(tableName)
        .withIndex("by_tenant" as any, (q: any) =>
          q.eq("tenantId", identity.tenantId)
        );
    }

    return filter(queryBuilder, (record) => {
      if (!includeSoftDeleted && record.deletedAt) {
        return false;
      }

      return evaluateFilter(record as any, filters);
    }).collect();
  },
});

/**
 * Get a single record using dynamic filters
 * Returns the first matching record or null
 */
export const dynamicGet = query({
  args: {
    tableName: v.string(),
    index: v.optional(
      v.object({
        name: v.string(),
        params: v.any(),
      })
    ),
    filters: v.optional(v.any()),
    includeSoftDeleted: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await isAuthenticated(ctx);
    const {
      tableName,
      index,
      filters,
      includeSoftDeleted = false,
    } = args as DynamicListArgs<keyof DataModel>;

    // Use same logic as dynamicList
    let queryBuilder: any;

    if (index) {
      queryBuilder = ctx.db
        .query(tableName)
        .withIndex(index.name as any, (q: any) => {
          let filtered = q;
          for (const [field, value] of Object.entries(index.params)) {
            filtered = filtered.eq(field, value);
          }
          filtered = filtered.eq("tenantId", identity.tenantId);
          return filtered;
        });
    } else {
      queryBuilder = ctx.db
        .query(tableName)
        .withIndex("by_tenant" as any, (q: any) =>
          q.eq("tenantId", identity.tenantId)
        );
    }

    let records: Doc<typeof tableName>[] = await queryBuilder.collect();

    if (!includeSoftDeleted) {
      records = records.filter((record: any) => !record.deletedAt);
    }

    if (filters) {
      records = records.filter((record) =>
        evaluateFilter(record as any, filters)
      );
    }

    return records[0] || null;
  },
});
