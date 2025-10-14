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
import type * as agents_crud from "../agents/crud.js";
import type * as agents_mutate_s from "../agents/mutate_s.js";
import type * as datasources_crud from "../datasources/crud.js";
import type * as datasources_mutate from "../datasources/mutate.js";
import type * as entities_crud from "../entities/crud.js";
import type * as entities_query from "../entities/query.js";
import type * as helpers_crudFactory from "../helpers/crudFactory.js";
import type * as helpers_shortcuts from "../helpers/shortcuts.js";
import type * as helpers_validators from "../helpers/validators.js";
import type * as integrations_query from "../integrations/query.js";
import type * as integrations_query_s from "../integrations/query_s.js";
import type * as roles_crud from "../roles/crud.js";
import type * as roles_query from "../roles/query.js";
import type * as scheduledjobs_crud from "../scheduledjobs/crud.js";
import type * as scheduledjobs_mutate from "../scheduledjobs/mutate.js";
import type * as scheduledjobs_query from "../scheduledjobs/query.js";
import type * as sites_crud from "../sites/crud.js";
import type * as sites_query from "../sites/query.js";
import type * as types_index from "../types/index.js";
import type * as types_normalized from "../types/normalized.js";
import type * as users_crud from "../users/crud.js";
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
  "agents/crud": typeof agents_crud;
  "agents/mutate_s": typeof agents_mutate_s;
  "datasources/crud": typeof datasources_crud;
  "datasources/mutate": typeof datasources_mutate;
  "entities/crud": typeof entities_crud;
  "entities/query": typeof entities_query;
  "helpers/crudFactory": typeof helpers_crudFactory;
  "helpers/shortcuts": typeof helpers_shortcuts;
  "helpers/validators": typeof helpers_validators;
  "integrations/query": typeof integrations_query;
  "integrations/query_s": typeof integrations_query_s;
  "roles/crud": typeof roles_crud;
  "roles/query": typeof roles_query;
  "scheduledjobs/crud": typeof scheduledjobs_crud;
  "scheduledjobs/mutate": typeof scheduledjobs_mutate;
  "scheduledjobs/query": typeof scheduledjobs_query;
  "sites/crud": typeof sites_crud;
  "sites/query": typeof sites_query;
  "types/index": typeof types_index;
  "types/normalized": typeof types_normalized;
  "users/crud": typeof users_crud;
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
