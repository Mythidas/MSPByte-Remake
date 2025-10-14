import { v } from "convex/values";
import { createCrudOperations } from "../helpers/crudFactory.js";
import { nullable } from "../helpers/shortcuts.js";

// ============================================================================
// VALIDATORS
// ============================================================================

const statusSchema = v.union(
  v.literal("pending"),
  v.literal("running"),
  v.literal("completed"),
  v.literal("failed")
);

const createValidator = v.object({
  integrationId: v.id("integrations"),
  integrationSlug: v.string(), // Slug for event routing (e.g., "autotask", "sophos-partner")
  dataSourceId: v.id("data_sources"),
  action: v.string(), // e.g., "sync.sites", "sync.devices"
  payload: v.any(),
  priority: v.optional(v.number()),
  status: statusSchema,
  attempts: v.optional(v.number()),
  attemptsMax: v.optional(v.number()),
  nextRetryAt: v.optional(v.number()),
  scheduledAt: v.number(),
  startedAt: v.optional(v.number()),
  error: v.optional(v.string()),
  createdBy: v.string(),
});

const updateValidator = v.object({
  action: nullable(v.string()),
  payload: nullable(v.any()),
  priority: nullable(v.number()),
  status: nullable(statusSchema),
  attempts: nullable(v.number()),
  attemptsMax: nullable(v.number()),
  nextRetryAt: nullable(v.number()),
  scheduledAt: nullable(v.number()),
  startedAt: nullable(v.number()),
  error: nullable(v.string()),
});

const getFiltersValidator = v.object({});

const filtersValidator = v.object({
  by_integration: v.optional(
    v.object({
      integrationId: v.id("integrations"),
    })
  ),
  by_pending_due: v.optional(
    v.object({
      status: statusSchema,
      scheduledAt: v.number(),
    })
  ),
  by_data_source: v.optional(
    v.object({
      dataSourceId: v.id("data_sources"),
    })
  ),
  by_data_source_status: v.optional(
    v.object({
      dataSourceId: v.id("data_sources"),
      status: statusSchema,
    })
  ),
  by_status: v.optional(
    v.object({
      status: statusSchema,
    })
  ),
  by_scheduled_at: v.optional(
    v.object({
      scheduledAt: v.number(),
    })
  ),
});

// ============================================================================
// GENERATED CRUD OPERATIONS
// ============================================================================

const crud = createCrudOperations({
  tableName: "scheduled_jobs",
  createValidator,
  updateValidator,
  filtersValidator,
  getFiltersValidator,
  softDelete: false,
});

// Export all generated CRUD operations
export const list = crud.list;
export const get = crud.get;
export const create = crud.create;

// Export internal functions for server-side use
export const list_s = crud.list_s;
export const get_s = crud.get_s;
export const create_s = crud.create_s;
export const update_s = crud.update_s;
export const remove_s = crud.delete_s;
