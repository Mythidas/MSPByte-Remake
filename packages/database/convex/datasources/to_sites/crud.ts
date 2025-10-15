import { v } from "convex/values";
import { createCrudOperations } from "../../helpers/crudFactory.js";

// ============================================================================
// VALIDATORS
// ============================================================================

const createValidator = v.object({
  tenantId: v.id("tenants"),
  dataSourceId: v.id("data_sources"),
  siteId: v.id("sites"),
});
const updateValidator = v.object({});
const getFiltersValidator = v.object({});

const filtersValidator = v.object({
  by_data_source: v.optional(
    v.object({
      dataSourceId: v.id("data_sources"),
    })
  ),
  by_site: v.optional(
    v.object({
      by_site: v.id("sites"),
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
export const batchc = crud.batchc;
export const create = crud.create;
export const remove = crud.delete;

// Export internal functions for server-side use
export const list_s = crud.list_s;
export const batchc_s = crud.batchc_s;
export const create_s = crud.create_s;
export const remove_s = crud.delete_s;
