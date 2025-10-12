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
import type * as agents_crud_s from "../agents/crud_s.js";
import type * as agents_internal from "../agents/internal.js";
import type * as datasources_crud from "../datasources/crud.js";
import type * as datasources_crud_s from "../datasources/crud_s.js";
import type * as datasources_internal from "../datasources/internal.js";
import type * as datasources_mutate from "../datasources/mutate.js";
import type * as datasources_query from "../datasources/query.js";
import type * as entities_crud from "../entities/crud.js";
import type * as entities_crud_s from "../entities/crud_s.js";
import type * as entities_query from "../entities/query.js";
import type * as events_log_crud_s from "../events_log/crud_s.js";
import type * as helpers_validators from "../helpers/validators.js";
import type * as integrations_crud_s from "../integrations/crud_s.js";
import type * as integrations_query from "../integrations/query.js";
import type * as scheduledjobs_crud from "../scheduledjobs/crud.js";
import type * as scheduledjobs_crud_s from "../scheduledjobs/crud_s.js";
import type * as scheduledjobs_mutate from "../scheduledjobs/mutate.js";
import type * as scheduledjobs_query from "../scheduledjobs/query.js";
import type * as sites_crud from "../sites/crud.js";
import type * as sites_crud_s from "../sites/crud_s.js";
import type * as sites_mutate from "../sites/mutate.js";
import type * as sites_query from "../sites/query.js";
import type * as types_index from "../types/index.js";
import type * as types_normalized from "../types/normalized.js";
import type * as users_crud from "../users/crud.js";
import type * as users_crud_s from "../users/crud_s.js";
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
  "agents/crud_s": typeof agents_crud_s;
  "agents/internal": typeof agents_internal;
  "datasources/crud": typeof datasources_crud;
  "datasources/crud_s": typeof datasources_crud_s;
  "datasources/internal": typeof datasources_internal;
  "datasources/mutate": typeof datasources_mutate;
  "datasources/query": typeof datasources_query;
  "entities/crud": typeof entities_crud;
  "entities/crud_s": typeof entities_crud_s;
  "entities/query": typeof entities_query;
  "events_log/crud_s": typeof events_log_crud_s;
  "helpers/validators": typeof helpers_validators;
  "integrations/crud_s": typeof integrations_crud_s;
  "integrations/query": typeof integrations_query;
  "scheduledjobs/crud": typeof scheduledjobs_crud;
  "scheduledjobs/crud_s": typeof scheduledjobs_crud_s;
  "scheduledjobs/mutate": typeof scheduledjobs_mutate;
  "scheduledjobs/query": typeof scheduledjobs_query;
  "sites/crud": typeof sites_crud;
  "sites/crud_s": typeof sites_crud_s;
  "sites/mutate": typeof sites_mutate;
  "sites/query": typeof sites_query;
  "types/index": typeof types_index;
  "types/normalized": typeof types_normalized;
  "users/crud": typeof users_crud;
  "users/crud_s": typeof users_crud_s;
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
