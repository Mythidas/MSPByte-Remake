import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { paginationOptsValidator } from "convex/server";

export type UserJWT = {
  sid: string;
  issuer: string;
  tokenIdentifier: string;
  subject: string;
};

export type PaginationState = {
  page: number;
  pageSize: number;
  search?: string;
  sorting?: Record<string, "asc" | "desc">;
  filters?: Record<string, any>;
};

export type PaginatedResult<T> = {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
};

// Filter operators matching Supabase ORM
export type FilterOperator =
  | "eq"
  | "neq"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "in"
  | "contains"
  | "startsWith"
  | "endsWith";

export type Filter = {
  field: string;
  operator: FilterOperator;
  value: any;
};

// Sort direction
export type SortDirection = "asc" | "desc";

export type SortConfig = {
  field: string;
  direction: SortDirection;
};

// Common query options
export type QueryOptions = {
  limit?: number;
  offset?: number;
  search?: string;
  filters?: Filter[];
  sort?: SortConfig;
};

/**
 * @deprecated Use client-side filtering with useClientTable instead.
 * This is only kept for backward compatibility with sites, users, and roles.
 * See agents/crud.ts for the new pattern using createCrudOperations.
 */
export const PaginationArgs = {
  order: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
  sortColumn: v.optional(v.string()),
  sortDirection: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
  globalSearch: v.optional(v.string()),
  paginationOpts: paginationOptsValidator,
};
