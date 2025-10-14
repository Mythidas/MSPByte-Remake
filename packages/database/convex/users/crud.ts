import { v } from "convex/values";
import { createCrudOperations } from "../helpers/crudFactory.js";
import { nullable } from "../helpers/shortcuts.js";

// ============================================================================
// VALIDATORS
// ============================================================================

const createValidator = v.object({
  roleId: v.id("roles"),
  clerkId: v.string(),
  email: v.string(),
  name: v.string(),
  status: v.union(v.literal("pending")),
  metadata: v.object({
    currentSite: v.optional(v.id("sites")),
  }),
});

const updateValidator = v.object({
  roleId: nullable(v.id("roles")),
  name: nullable(v.string()),
  status: nullable(v.union(v.literal("active"), v.literal("inactive"))),
  metadata: nullable(
    v.object({
      currentSite: nullable(v.id("sites")),
    })
  ),
});

const getFiltersValidator = v.object({
  by_email: v.optional(
    v.object({
      email: v.string(),
    })
  ),
  by_clerk: v.optional(
    v.object({
      clerkId: v.string(),
    })
  ),
});

const filtersValidator = v.object({
  by_role: v.optional(
    v.object({
      roleId: v.id("roles"),
    })
  ),
});

// ============================================================================
// GENERATED CRUD OPERATIONS
// ============================================================================

const crud = createCrudOperations({
  tableName: "users",
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
