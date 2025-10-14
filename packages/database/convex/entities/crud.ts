import { v } from "convex/values";
import { createCrudOperations } from "../helpers/crudFactory.js";
import { entityTypeValidator } from "../schema.js";
import { nullable } from "../helpers/shortcuts.js";

// ============================================================================
// VALIDATORS
// ============================================================================

const createValidator = v.object({
  integrationId: v.id("integrations"),
  dataSourceId: v.id("data_sources"),
  siteId: v.optional(v.id("sites")),
  entityType: entityTypeValidator,
  externalId: v.string(),
  dataHash: v.string(),
  rawData: v.any(),
  normalizedData: v.any(),
});

const updateValidator = v.object({
  entityType: nullable(entityTypeValidator),
  dataHash: nullable(v.string()),
  rawData: nullable(v.any()),
  normalizedData: nullable(v.any()),
});

const getFiltersValidator = v.object({
  by_external_id: v.optional(
    v.object({
      externalId: v.string(),
    })
  ),
});

const filtersValidator = v.object({
  by_integration: v.optional(
    v.object({
      integrationId: v.id("integrations"),
    })
  ),
  by_type: v.optional(
    v.object({
      entityType: entityTypeValidator,
    })
  ),
  by_data_source: v.optional(
    v.object({
      dataSourceId: v.id("data_sources"),
    })
  ),
  by_site: v.optional(
    v.object({
      siteId: v.id("sites"),
    })
  ),
  by_integration_type: v.optional(
    v.object({
      integrationId: v.id("integrations"),
      entityType: entityTypeValidator,
    })
  ),
});

// ============================================================================
// GENERATED CRUD OPERATIONS
// ============================================================================

const crud = createCrudOperations({
  tableName: "entities",
  createValidator,
  updateValidator,
  filtersValidator,
  getFiltersValidator,
  softDelete: false,
});

// Export all generated CRUD operations
export const list = crud.list;
export const get = crud.get;

// Export internal functions for server-side use
export const list_s = crud.list_s;
export const get_s = crud.get_s;
export const create_s = crud.create_s;
export const update_s = crud.update_s;
export const remove_s = crud.delete_s;
