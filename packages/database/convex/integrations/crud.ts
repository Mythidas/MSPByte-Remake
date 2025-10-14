import { v } from "convex/values";
import { createCrudOperations } from "../helpers/crudFactory.js";

// ============================================================================
// VALIDATORS
// ============================================================================

const createValidator = v.object({});
const updateValidator = v.object({});

const getFiltersValidator = v.object({
  by_slug: v.optional(
    v.object({
      slug: v.string(),
    })
  ),
});

const filtersValidator = v.object({
  by_category: v.optional(
    v.object({
      category: v.string(),
    })
  ),
  by_is_active: v.optional(
    v.object({
      isActive: v.boolean(),
    })
  ),
});

// ============================================================================
// GENERATED CRUD OPERATIONS
// ============================================================================

const crud = createCrudOperations({
  tableName: "integrations",
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
