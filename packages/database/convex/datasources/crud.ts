import { v } from "convex/values";
import { createCrudOperations } from "../helpers/crudFactory.js";
import { nullable } from "../helpers/shortcuts.js";

// ============================================================================
// VALIDATORS
// ============================================================================

const createValidator = v.object({
  integrationId: v.id("integrations"),
  siteId: v.optional(v.id("sites")),
  externalId: v.optional(v.string()),
  isPrimary: v.boolean(),
  status: v.union(v.literal("active"), v.literal("inactive")),
  config: v.any(),
  metadata: v.optional(v.any()),
  credentialExpirationAt: v.number(),
});

const updateValidator = v.object({
  status: nullable(
    v.union(v.literal("active"), v.literal("inactive"), v.literal("error"))
  ),
  config: nullable(v.any()),
  metadata: nullable(v.any()),
  credentialExpirationAt: nullable(v.number()),
});

const getFiltersValidator = v.object({
  by_external_id: v.optional(
    v.object({
      externalId: v.string(),
    })
  ),
  by_integration_primary: v.optional(
    v.object({
      integrationId: v.id("integrations"),
      isPrimary: v.boolean(),
    })
  ),
});

const filtersValidator = v.object({
  by_site: v.optional(
    v.object({
      siteId: v.id("sites"),
    })
  ),
  by_integration: v.optional(
    v.object({
      integrationId: v.id("integrations"),
    })
  ),
  by_primary: v.optional(
    v.object({
      isPrimary: v.boolean(),
    })
  ),
});

// ============================================================================
// GENERATED CRUD OPERATIONS
// ============================================================================

const crud = createCrudOperations({
  tableName: "data_sources",
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
