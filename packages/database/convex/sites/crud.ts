import { v } from "convex/values";
import { createCrudOperations } from "../helpers/crudFactory.js";
import { nullable } from "../helpers/shortcuts.js";

// ============================================================================
// VALIDATORS
// ============================================================================

const createValidator = v.object({
  name: v.string(),
  slug: v.string(),
  status: v.union(v.literal("active")),
  psaIntegrationId: v.optional(v.id("integrations")),
  psaIntegrationName: v.optional(v.string()), // Denormalized for sorting/filtering
  psaCompanyId: v.optional(v.string()),
  psaParentCompanyId: v.optional(v.string()),
  metadata: v.optional(v.any()),
});

const updateValidator = v.object({
  name: nullable(v.string()),
  status: nullable(
    v.union(v.literal("active"), v.literal("inactive"), v.literal("archived"))
  ),
  psaIntegrationId: nullable(v.id("integrations")),
  psaIntegrationName: nullable(v.string()),
  psaCompanyId: nullable(v.string()),
  psaParentCompanyId: nullable(v.string()),
  metadata: nullable(v.any()),
});

const getFiltersValidator = v.object({});

const filtersValidator = v.object({
  by_integration: v.optional(
    v.object({
      integrationId: v.id("integrations"),
    })
  ),
  by_status: v.optional(
    v.object({
      status: v.union(v.literal("active"), v.literal("inactive")),
    })
  ),
});

// ============================================================================
// GENERATED CRUD OPERATIONS
// ============================================================================

const crud = createCrudOperations({
  tableName: "sites",
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
