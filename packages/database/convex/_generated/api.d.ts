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
import type * as agents_mutate from "../agents/mutate.js";
import type * as agents_query from "../agents/query.js";
import type * as datasources_mutate from "../datasources/mutate.js";
import type * as datasources_query from "../datasources/query.js";
import type * as entities_query from "../entities/query.js";
import type * as helper from "../helper.js";
import type * as http from "../http.js";
import type * as integrations_query from "../integrations/query.js";
import type * as scheduledjobs_mutate from "../scheduledjobs/mutate.js";
import type * as scheduledjobs_query from "../scheduledjobs/query.js";
import type * as sites_mutate from "../sites/mutate.js";
import type * as sites_query from "../sites/query.js";
import type * as types from "../types.js";
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
  "agents/mutate": typeof agents_mutate;
  "agents/query": typeof agents_query;
  "datasources/mutate": typeof datasources_mutate;
  "datasources/query": typeof datasources_query;
  "entities/query": typeof entities_query;
  helper: typeof helper;
  http: typeof http;
  "integrations/query": typeof integrations_query;
  "scheduledjobs/mutate": typeof scheduledjobs_mutate;
  "scheduledjobs/query": typeof scheduledjobs_query;
  "sites/mutate": typeof sites_mutate;
  "sites/query": typeof sites_query;
  types: typeof types;
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
