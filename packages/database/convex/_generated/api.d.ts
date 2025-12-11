/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as agents_mutate_s from "../agents/mutate_s.js";
import type * as datasources_mutate from "../datasources/mutate.js";
import type * as datasources_query from "../datasources/query.js";
import type * as entity_alerts_mutate from "../entity_alerts/mutate.js";
import type * as entity_alerts_query from "../entity_alerts/query.js";
import type * as helpers_audit from "../helpers/audit.js";
import type * as helpers_crud_get from "../helpers/crud/get.js";
import type * as helpers_crud_insert from "../helpers/crud/insert.js";
import type * as helpers_crud_list from "../helpers/crud/list.js";
import type * as helpers_crud_remove from "../helpers/crud/remove.js";
import type * as helpers_crud_types from "../helpers/crud/types.js";
import type * as helpers_crud_update from "../helpers/crud/update.js";
import type * as helpers_orm from "../helpers/orm.js";
import type * as helpers_shortcuts from "../helpers/shortcuts.js";
import type * as helpers_validators from "../helpers/validators.js";
import type * as landing_query from "../landing/query.js";
import type * as migrations_mutate from "../migrations/mutate.js";
import type * as roles_query from "../roles/query.js";
import type * as sites_mutate from "../sites/mutate.js";
import type * as sites_query from "../sites/query.js";
import type * as tenants_query from "../tenants/query.js";
import type * as ticket_usage_mutate_s from "../ticket_usage/mutate_s.js";
import type * as types_index from "../types/index.js";
import type * as types_normalized from "../types/normalized.js";
import type * as types_normalized from "../types/normalized.js";
import type * as users_mutate from "../users/mutate.js";
import type * as users_query from "../users/query.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "agents/mutate_s": typeof agents_mutate_s;
  "datasources/mutate": typeof datasources_mutate;
  "datasources/query": typeof datasources_query;
  "entity_alerts/mutate": typeof entity_alerts_mutate;
  "entity_alerts/query": typeof entity_alerts_query;
  "helpers/audit": typeof helpers_audit;
  "helpers/crud/get": typeof helpers_crud_get;
  "helpers/crud/insert": typeof helpers_crud_insert;
  "helpers/crud/list": typeof helpers_crud_list;
  "helpers/crud/remove": typeof helpers_crud_remove;
  "helpers/crud/types": typeof helpers_crud_types;
  "helpers/crud/update": typeof helpers_crud_update;
  "helpers/orm": typeof helpers_orm;
  "helpers/shortcuts": typeof helpers_shortcuts;
  "helpers/validators": typeof helpers_validators;
  "landing/query": typeof landing_query;
  "migrations/mutate": typeof migrations_mutate;
  "roles/query": typeof roles_query;
  "sites/mutate": typeof sites_mutate;
  "sites/query": typeof sites_query;
  "tenants/query": typeof tenants_query;
  "ticket_usage/mutate_s": typeof ticket_usage_mutate_s;
  "types/index": typeof types_index;
  "types/normalized": typeof types_normalized;
  "types/normalized": typeof types_normalized;
  "users/mutate": typeof users_mutate;
  "users/query": typeof users_query;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
