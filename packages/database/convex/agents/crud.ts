import { v } from "convex/values";
import { createCrudOperations } from "../helpers/crudFactory.js";
import { nullable } from "../helpers/shortcuts.js";

// ============================================================================
// VALIDATORS
// ============================================================================

const createValidator = v.object({
  siteId: v.id("sites"),
  guid: v.string(),
  hostname: v.string(),
  platform: v.optional(v.string()),
  version: v.optional(v.string()),
  ipAddress: v.optional(v.string()),
  macAddress: v.optional(v.string()),
  extAddress: v.optional(v.string()),
  status: v.optional(v.union(v.literal("online"), v.literal("offline"))),
  registeredAt: v.optional(v.number()),
});

const updateValidator = v.object({
  siteId: nullable(v.id("sites")),
  guid: nullable(v.string()),
  hostname: nullable(v.string()),
  platform: nullable(v.string()),
  version: nullable(v.string()),
  ipAddress: nullable(v.string()),
  macAddress: nullable(v.string()),
  extAddress: nullable(v.string()),
  status: nullable(v.union(v.literal("online"), v.literal("offline"))),
  statusChangedAt: nullable(v.number()),
  registeredAt: nullable(v.number()),
});

const getFiltersValidator = v.object({
  by_guid: v.optional(
    v.object({
      guid: v.string(),
    })
  ),
});

const filtersValidator = v.object({
  by_site: v.optional(
    v.object({
      siteId: v.id("sites"),
    })
  ),
  by_status: v.optional(
    v.object({
      status: v.union(v.literal("online"), v.literal("offline")),
    })
  ),
  by_platform: v.optional(
    v.object({
      platform: v.string(),
    })
  ),
  by_version: v.optional(
    v.object({
      version: v.string(),
    })
  ),
});

// ============================================================================
// GENERATED CRUD OPERATIONS
// ============================================================================

const crud = createCrudOperations({
  tableName: "agents",
  createValidator,
  updateValidator,
  filtersValidator,
  getFiltersValidator,
  softDelete: true,
});

// Export all generated CRUD operations
export const list = crud.list;
export const get = crud.get;
export const create = crud.create;
export const update = crud.update;
export const remove = crud.delete;

// Export internal functions for server-side use
export const list_s = crud.list_s;
export const get_s = crud.get_s;
export const create_s = crud.create_s;
export const update_s = crud.update_s;
export const remove_s = crud.delete_s;
