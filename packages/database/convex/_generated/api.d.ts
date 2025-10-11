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
import type * as agents_internal from "../agents/internal.js";
import type * as datasources_crud from "../datasources/crud.js";
import type * as datasources_internal from "../datasources/internal.js";
import type * as datasources_mutate from "../datasources/mutate.js";
import type * as datasources_query from "../datasources/query.js";
import type * as entities_crud from "../entities/crud.js";
import type * as entities_query from "../entities/query.js";
import type * as helpers_validators from "../helpers/validators.js";
import type * as integrations_query from "../integrations/query.js";
import type * as scheduledjobs_crud from "../scheduledjobs/crud.js";
import type * as scheduledjobs_mutate from "../scheduledjobs/mutate.js";
import type * as scheduledjobs_query from "../scheduledjobs/query.js";
import type * as sites_crud from "../sites/crud.js";
import type * as sites_internal from "../sites/internal.js";
import type * as sites_mutate from "../sites/mutate.js";
import type * as sites_query from "../sites/query.js";
import type * as types from "../types.js";
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
  "agents/internal": typeof agents_internal;
  "datasources/crud": typeof datasources_crud;
  "datasources/internal": typeof datasources_internal;
  "datasources/mutate": typeof datasources_mutate;
  "datasources/query": typeof datasources_query;
  "entities/crud": typeof entities_crud;
  "entities/query": typeof entities_query;
  "helpers/validators": typeof helpers_validators;
  "integrations/query": typeof integrations_query;
  "scheduledjobs/crud": typeof scheduledjobs_crud;
  "scheduledjobs/mutate": typeof scheduledjobs_mutate;
  "scheduledjobs/query": typeof scheduledjobs_query;
  "sites/crud": typeof sites_crud;
  "sites/internal": typeof sites_internal;
  "sites/mutate": typeof sites_mutate;
  "sites/query": typeof sites_query;
  types: typeof types;
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
