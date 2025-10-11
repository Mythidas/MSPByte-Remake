import { v } from "convex/values";
import { query, mutation } from "../_generated/server.js";
import { isAuthenticated, isValidTenant } from "../helpers/validators.js";
import type { OrderedQuery, Query } from "convex/server";
import type { DataModel, Id } from "../_generated/dataModel.js";
import { paginationOptsValidator } from "convex/server";

// ============================================================================
// TYPES
// ============================================================================

const entityTypeValidator = v.union(
  v.literal("companies"),
  v.literal("endpoints"),
  v.literal("identities")
);

// ============================================================================
// SHARED HELPER
// ============================================================================

/**
 * Builds a progressive query for entities based on provided filters.
 * Selects the most efficient index based on which filters are provided.
 */
function buildProgressiveQuery(
  ctx: any,
  tenantId: Id<"tenants">,
  filters: {
    integrationId?: Id<"integrations">;
    entityType?: "companies" | "endpoints" | "identities";
    dataSourceId?: Id<"data_sources">;
    siteId?: Id<"sites">;
  }
): Query<DataModel["entities"]> {
  const { integrationId, entityType, dataSourceId, siteId } = filters;

  // Progressive index selection - choose most specific index with time ordering
  if (integrationId && entityType) {
    return ctx.db
      .query("entities")
      .withIndex("by_integration_type_ordered", (q: any) =>
        q
          .eq("integrationId", integrationId)
          .eq("entityType", entityType)
          .eq("tenantId", tenantId)
      );
  } else if (integrationId) {
    return ctx.db
      .query("entities")
      .withIndex("by_integration_ordered", (q: any) =>
        q.eq("integrationId", integrationId).eq("tenantId", tenantId)
      );
  } else if (dataSourceId) {
    return ctx.db
      .query("entities")
      .withIndex("by_data_source", (q: any) =>
        q.eq("dataSourceId", dataSourceId).eq("tenantId", tenantId)
      );
  } else if (siteId) {
    return ctx.db
      .query("entities")
      .withIndex("by_site", (q: any) =>
        q.eq("siteId", siteId).eq("tenantId", tenantId)
      );
  } else if (entityType) {
    return ctx.db
      .query("entities")
      .withIndex("by_type", (q: any) =>
        q.eq("entityType", entityType).eq("tenantId", tenantId)
      );
  } else {
    // Fallback to tenant-only query with time ordering
    return ctx.db
      .query("entities")
      .withIndex("by_tenant_ordered", (q: any) => q.eq("tenantId", tenantId));
  }
}

// ============================================================================
// CRUD OPERATIONS
// ============================================================================

/**
 * List entities with optional filtering, ordering, and pagination.
 *
 * @example
 * // Get all entities for an integration
 * await ctx.runQuery(api.entities.crud.list, { integrationId: "..." })
 *
 * @example
 * // Get paginated companies, newest first
 * await ctx.runQuery(api.entities.crud.list, {
 *   entityType: "companies",
 *   order: "desc",
 *   paginationOpts: { numItems: 50, cursor: null }
 * })
 */
export const list = query({
  args: {
    integrationId: v.optional(v.id("integrations")),
    entityType: v.optional(entityTypeValidator),
    dataSourceId: v.optional(v.id("data_sources")),
    siteId: v.optional(v.id("sites")),
    order: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
    paginationOpts: v.optional(paginationOptsValidator),
  },
  handler: async (ctx, args) => {
    const identity = await isAuthenticated(ctx);
    const { order = "desc", paginationOpts, ...filters } = args;

    // Build progressive query
    let indexedQuery = buildProgressiveQuery(ctx, identity.tenantId, filters);

    // Apply ordering
    let query: OrderedQuery<DataModel["entities"]> = indexedQuery;
    query = indexedQuery.order(order);

    // Return paginated or full results
    if (paginationOpts) {
      return await query.paginate(paginationOpts);
    } else {
      return await query.collect();
    }
  },
});

/**
 * Get a single entity - supports both direct ID lookup and filter-based queries.
 *
 * @example
 * // Get by ID
 * await ctx.runQuery(api.entities.crud.get, { id: "..." })
 *
 * @example
 * // Get newest company entity for an integration
 * await ctx.runQuery(api.entities.crud.get, {
 *   integrationId: "...",
 *   entityType: "companies"
 * })
 */
export const get = query({
  args: {
    id: v.optional(v.id("entities")),
    integrationId: v.optional(v.id("integrations")),
    entityType: v.optional(entityTypeValidator),
    dataSourceId: v.optional(v.id("data_sources")),
    siteId: v.optional(v.id("sites")),
    externalId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await isAuthenticated(ctx);

    // Direct ID lookup mode
    if (args.id) {
      const entity = await ctx.db.get(args.id);
      if (entity) {
        await isValidTenant(identity.tenantId, entity.tenantId);
      }
      return entity;
    }

    // Filter-based mode - special case for externalId lookup
    if (args.integrationId && args.externalId) {
      return await ctx.db
        .query("entities")
        .withIndex("by_external_id", (q) =>
          q
            .eq("integrationId", args.integrationId!)
            .eq("externalId", args.externalId!)
            .eq("tenantId", identity.tenantId)
        )
        .unique();
    }

    // Filter-based mode - use progressive query builder
    const { id, externalId, ...filters } = args;
    const query = buildProgressiveQuery(ctx, identity.tenantId, filters);

    // Always get newest record when using filters
    return await query.order("desc").first();
  },
});

/**
 * Update an entity by ID.
 *
 * @example
 * await ctx.runMutation(api.entities.crud.update, {
 *   id: "...",
 *   updates: { dataHash: "newHash", normalizedData: {...} }
 * })
 */
export const update = mutation({
  args: {
    id: v.id("entities"),
    updates: v.object({
      entityType: v.optional(entityTypeValidator),
      externalId: v.optional(v.string()),
      dataHash: v.optional(v.string()),
      rawData: v.optional(v.any()),
      normalizedData: v.optional(v.any()),
    }),
  },
  handler: async (ctx, args) => {
    const identity = await isAuthenticated(ctx);
    const entity = await ctx.db.get(args.id);

    if (!entity) {
      throw new Error("Entity not found");
    }

    await isValidTenant(identity.tenantId, entity.tenantId);

    // Update with automatic timestamp
    await ctx.db.patch(args.id, {
      ...args.updates,
      updatedAt: Date.now(),
    });

    return await ctx.db.get(args.id);
  },
});

/**
 * Delete an entity by ID.
 * Note: Entities table doesn't have deletedAt, so this is a hard delete.
 *
 * @example
 * await ctx.runMutation(api.entities.crud.delete, { id: "..." })
 */
export const deleteEntity = mutation({
  args: {
    id: v.id("entities"),
  },
  handler: async (ctx, args) => {
    const identity = await isAuthenticated(ctx);
    const entity = await ctx.db.get(args.id);

    if (!entity) {
      throw new Error("Entity not found");
    }

    await isValidTenant(identity.tenantId, entity.tenantId);

    await ctx.db.delete(args.id);
    return true;
  },
});
