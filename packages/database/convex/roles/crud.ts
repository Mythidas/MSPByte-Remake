import { v } from "convex/values";
import { createCrudOperations } from "../helpers/crudFactory.js";
import { nullable } from "../helpers/shortcuts.js";

// ============================================================================
// VALIDATORS
// ============================================================================

const createValidator = v.object({
  name: v.string(),
  description: v.string(),
  rights: v.any(),
});

const updateValidator = v.object({
  name: nullable(v.string()),
  description: nullable(v.string()),
  rights: nullable(v.any()),
});

const getFiltersValidator = v.object({});
const filtersValidator = v.object({});

// ============================================================================
// GENERATED CRUD OPERATIONS
// ============================================================================

const crud = createCrudOperations({
  tableName: "roles",
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
