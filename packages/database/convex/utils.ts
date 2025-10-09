import { QueryInitializer, OrderedQuery } from "convex/server";
import { GenericId } from "convex/values";
import type { Filter, SortConfig, PaginatedResult, QueryOptions } from "./types";

/**
 * Utility functions for common Convex operations
 *
 * These helpers provide a consistent API similar to the Supabase ORM
 * for filtering, sorting, and pagination.
 */

/**
 * Apply filters to a Convex query
 *
 * @example
 * let query = ctx.db.query("sites");
 * query = applyFilters(query, [
 *   { field: "status", operator: "eq", value: "active" },
 *   { field: "name", operator: "contains", value: "acme" }
 * ]);
 */
export function applyFilters<T>(
  query: QueryInitializer<T>,
  filters?: Filter[]
): QueryInitializer<T> {
  if (!filters || filters.length === 0) return query;

  return query.filter((q) => {
    let result: any = true;

    for (const filter of filters) {
      const fieldValue = q.field(filter.field as any);

      switch (filter.operator) {
        case "eq":
          result = q.and(result, q.eq(fieldValue, filter.value));
          break;
        case "neq":
          result = q.and(result, q.neq(fieldValue, filter.value));
          break;
        case "gt":
          result = q.and(result, q.gt(fieldValue, filter.value));
          break;
        case "gte":
          result = q.and(result, q.gte(fieldValue, filter.value));
          break;
        case "lt":
          result = q.and(result, q.lt(fieldValue, filter.value));
          break;
        case "lte":
          result = q.and(result, q.lte(fieldValue, filter.value));
          break;
        default:
          // For complex operators like "contains", "startsWith", etc.
          // these will need to be implemented in the query handler
          break;
      }
    }

    return result;
  });
}

/**
 * Apply sorting to a Convex query
 *
 * @example
 * let query = ctx.db.query("sites");
 * query = applySorting(query, { field: "name", direction: "asc" });
 */
export function applySorting<T>(
  query: QueryInitializer<T>,
  sort?: SortConfig
): OrderedQuery<T> {
  if (!sort) {
    return query.order("desc");
  }

  return query.order(sort.direction, sort.field as any);
}

/**
 * Apply pagination to a query and return results
 *
 * @example
 * const result = await paginate(
 *   ctx.db.query("sites"),
 *   { limit: 10, offset: 0 }
 * );
 */
export async function paginate<T>(
  query: QueryInitializer<T> | OrderedQuery<T>,
  options: { limit?: number; offset?: number } = {}
): Promise<PaginatedResult<T>> {
  const limit = options.limit ?? 100;
  const offset = options.offset ?? 0;

  // Get one extra to check if there are more results
  const rows = await (query as OrderedQuery<T>).take(limit + 1 + offset);

  // Remove the offset items
  const paginatedRows = rows.slice(offset);

  // Check if we have more results
  const hasMore = paginatedRows.length > limit;

  // Return only the requested amount
  const finalRows = paginatedRows.slice(0, limit);

  return {
    rows: finalRows,
    total: rows.length, // Note: This is approximate, full count requires separate query
    page: Math.floor(offset / limit),
    pageSize: limit,
    hasMore,
  };
}

/**
 * Convert a string search term into a filter that searches multiple fields
 *
 * @example
 * const filters = createSearchFilters("acme", ["name", "slug"]);
 */
export function createSearchFilters(search: string, fields: string[]): Filter[] {
  if (!search || search.trim() === "") return [];

  return fields.map((field) => ({
    field,
    operator: "contains" as const,
    value: search.toLowerCase(),
  }));
}

/**
 * Helper to convert Supabase-style filter array to Convex Filter type
 *
 * @example
 * const filters = convertSupabaseFilters([
 *   ["status", "eq", "active"],
 *   ["tenantId", "eq", tenantId]
 * ]);
 */
export function convertSupabaseFilters(
  supabaseFilters: Array<[string, string, any]>
): Filter[] {
  return supabaseFilters.map(([field, operator, value]) => ({
    field,
    operator: operator as any,
    value,
  }));
}

/**
 * Build a paginated query with all common options
 *
 * This is a convenience function that combines filtering, sorting, and pagination.
 *
 * @example
 * const result = await buildPaginatedQuery(
 *   ctx.db.query("sites"),
 *   {
 *     limit: 10,
 *     offset: 0,
 *     filters: [{ field: "status", operator: "eq", value: "active" }],
 *     sort: { field: "name", direction: "asc" }
 *   }
 * );
 */
export async function buildPaginatedQuery<T>(
  query: QueryInitializer<T>,
  options: QueryOptions = {}
): Promise<PaginatedResult<T>> {
  // Apply filters
  let filteredQuery = applyFilters(query, options.filters);

  // Apply sorting
  const sortedQuery = applySorting(filteredQuery, options.sort);

  // Apply pagination
  return await paginate(sortedQuery, {
    limit: options.limit,
    offset: options.offset,
  });
}

/**
 * Generate a slug from a string
 */
export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Get current timestamp (Convex uses milliseconds since epoch)
 */
export function now(): number {
  return Date.now();
}
