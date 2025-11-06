/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as agents_mutate_s from "../agents/mutate_s.js";
import type * as datasources_mutate from "../datasources/mutate.js";
import type * as entities_query from "../entities/query.js";
import type * as entity_alerts_mutations from "../entity_alerts/mutations.js";
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
import type * as integrations_query from "../integrations/query.js";
import type * as integrations_query_s from "../integrations/query_s.js";
import type * as roles_query from "../roles/query.js";
import type * as scheduledjobs_mutate from "../scheduledjobs/mutate.js";
import type * as scheduledjobs_query from "../scheduledjobs/query.js";
import type * as sites_query from "../sites/query.js";
import type * as tenants_query from "../tenants/query.js";
import type * as types_index from "../types/index.js";
import type * as types_normalized from "../types/normalized.js";
import type * as users_mutate from "../users/mutate.js";
import type * as users_query from "../users/query.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  "agents/mutate_s": typeof agents_mutate_s;
  "datasources/mutate": typeof datasources_mutate;
  "entities/query": typeof entities_query;
  "entity_alerts/mutations": typeof entity_alerts_mutations;
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
  "integrations/query": typeof integrations_query;
  "integrations/query_s": typeof integrations_query_s;
  "roles/query": typeof roles_query;
  "scheduledjobs/mutate": typeof scheduledjobs_mutate;
  "scheduledjobs/query": typeof scheduledjobs_query;
  "sites/query": typeof sites_query;
  "tenants/query": typeof tenants_query;
  "types/index": typeof types_index;
  "types/normalized": typeof types_normalized;
  "users/mutate": typeof users_mutate;
  "users/query": typeof users_query;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
