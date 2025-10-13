import { v } from "convex/values";
import { createCrudOperations } from "../helpers/crudFactory.js";

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
  siteId: v.optional(v.id("sites")),
  guid: v.optional(v.string()),
  hostname: v.optional(v.string()),
  platform: v.optional(v.string()),
  version: v.optional(v.string()),
  ipAddress: v.optional(v.string()),
  macAddress: v.optional(v.string()),
  extAddress: v.optional(v.string()),
  status: v.optional(v.union(v.literal("online"), v.literal("offline"))),
  statusChangedAt: v.optional(v.number()),
  registeredAt: v.optional(v.number()),
});

const filtersValidator = v.object({
  siteId: v.optional(v.id("sites")),
  guid: v.optional(v.string()),
  status: v.optional(v.union(v.literal("online"), v.literal("offline"))),
});

// ============================================================================
// GENERATED CRUD OPERATIONS
// ============================================================================

const crud = createCrudOperations({
  tableName: "agents",
  createValidator,
  updateValidator,
  filtersValidator,
  softDelete: true,
  // Map filters to efficient indices
  indexMap: {
    siteId: "by_site_ordered",
    guid: "by_guid",
  },
});

// Export all generated CRUD operations
export const list = crud.list;
export const get = crud.get;
export const create = crud.create;
export const update = crud.update;
export const deleteAgent = crud.delete;

// Export internal functions for server-side use
export const listInternal = crud.listInternal;
export const getInternal = crud.getInternal;
export const createInternal = crud.createInternal;
export const updateInternal = crud.updateInternal;
export const deleteInternal = crud.deleteInternal;

// ============================================================================
// CUSTOM AGENT-SPECIFIC OPERATIONS
// ============================================================================

// Add any agent-specific business logic here as separate functions
// For example: registration, heartbeat handling, etc.
