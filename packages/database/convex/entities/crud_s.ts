import { v } from "convex/values";
import { query, mutation } from "../_generated/server.js";
import { isValidSecret } from "../helpers/validators.js";
import type { OrderedQuery, Query } from "convex/server";
import type { DataModel, Id } from "../_generated/dataModel.js";
import { paginationOptsValidator } from "convex/server";
import { entityTypeValidator } from "../schema.js";

export type EntityType =
  | "companies"
  | "endpoints"
  | "identities"
  | "groups"
  | "licenseAssignments";

// ============================================================================
// SHARED HELPER
// ============================================================================

/**
 * Builds a progressive query for entities based on provided filters.
 * Note: tenantId is optional for server queries (allows cross-tenant operations)
 */
function buildProgressiveQuery(
  ctx: any,
  tenantId: Id<"tenants"> | undefined,
  filters: {
    integrationId?: Id<"integrations">;
    entityType?: EntityType;
    dataSourceId?: Id<"data_sources">;
    siteId?: Id<"sites">;
  }
): Query<DataModel["entities"]> {
  const { integrationId, entityType, dataSourceId, siteId } = filters;

  // Progressive index selection with optional tenant filtering
  if (integrationId && entityType && tenantId) {
    return ctx.db
      .query("entities")
      .withIndex("by_integration_type_ordered", (q: any) =>
        q
          .eq("integrationId", integrationId)
          .eq("entityType", entityType)
          .eq("tenantId", tenantId)
      );
  } else if (integrationId && tenantId) {
    return ctx.db
      .query("entities")
      .withIndex("by_integration_ordered", (q: any) =>
        q.eq("integrationId", integrationId).eq("tenantId", tenantId)
      );
  } else if (dataSourceId && tenantId) {
    return ctx.db
      .query("entities")
      .withIndex("by_data_source", (q: any) =>
        q.eq("dataSourceId", dataSourceId).eq("tenantId", tenantId)
      );
  } else if (siteId && tenantId) {
    return ctx.db
      .query("entities")
      .withIndex("by_site", (q: any) =>
        q.eq("siteId", siteId).eq("tenantId", tenantId)
      );
  } else if (entityType && tenantId) {
    return ctx.db
      .query("entities")
      .withIndex("by_type", (q: any) =>
        q.eq("entityType", entityType).eq("tenantId", tenantId)
      );
  } else if (tenantId) {
    return ctx.db
      .query("entities")
      .withIndex("by_tenant_ordered", (q: any) => q.eq("tenantId", tenantId));
  } else {
    // No tenant filter - return all entities (admin use case)
    return ctx.db.query("entities");
  }
}

// ============================================================================
// SERVER CRUD OPERATIONS
// ============================================================================

/**
 * Server-side list with secret authentication.
 * Always returns full array of results (no pagination).
 * Allows optional tenantId for cross-tenant queries.
 */
export const list = query({
  args: {
    secret: v.string(),
    tenantId: v.optional(v.id("tenants")),
    integrationId: v.optional(v.id("integrations")),
    entityType: v.optional(entityTypeValidator),
    dataSourceId: v.optional(v.id("data_sources")),
    siteId: v.optional(v.id("sites")),
    order: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
  },
  handler: async (ctx, args) => {
    await isValidSecret(args.secret);
    const { secret, order = "desc", tenantId, ...filters } = args;

    // Build progressive query
    let indexedQuery = buildProgressiveQuery(ctx, tenantId, filters);

    // Apply ordering
    let query: OrderedQuery<DataModel["entities"]> = indexedQuery;
    query = indexedQuery.order(order);

    return await query.collect();
  },
});

/**
 * Server-side paginated list with secret authentication.
 * Returns paginated results for large datasets.
 * Allows optional tenantId for cross-tenant queries.
 */
export const paginate = query({
  args: {
    secret: v.string(),
    tenantId: v.optional(v.id("tenants")),
    integrationId: v.optional(v.id("integrations")),
    entityType: v.optional(entityTypeValidator),
    dataSourceId: v.optional(v.id("data_sources")),
    siteId: v.optional(v.id("sites")),
    order: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    await isValidSecret(args.secret);
    const {
      secret,
      order = "desc",
      paginationOpts,
      tenantId,
      ...filters
    } = args;

    // Build progressive query
    let indexedQuery = buildProgressiveQuery(ctx, tenantId, filters);

    // Apply ordering
    let query: OrderedQuery<DataModel["entities"]> = indexedQuery;
    query = indexedQuery.order(order);

    return await query.paginate(paginationOpts);
  },
});

/**
 * Server-side get with secret authentication.
 * Supports both direct ID lookup and filter-based queries.
 */
export const get = query({
  args: {
    secret: v.string(),
    id: v.optional(v.id("entities")),
    tenantId: v.optional(v.id("tenants")),
    integrationId: v.optional(v.id("integrations")),
    entityType: v.optional(entityTypeValidator),
    dataSourceId: v.optional(v.id("data_sources")),
    siteId: v.optional(v.id("sites")),
    externalId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await isValidSecret(args.secret);

    // Direct ID lookup mode
    if (args.id) {
      return await ctx.db.get(args.id);
    }

    // Filter-based mode - special case for externalId lookup
    if (args.integrationId && args.externalId && args.tenantId) {
      return await ctx.db
        .query("entities")
        .withIndex("by_external_id", (q) =>
          q
            .eq("integrationId", args.integrationId!)
            .eq("externalId", args.externalId!)
            .eq("tenantId", args.tenantId!)
        )
        .unique();
    }

    // Filter-based mode - use progressive query builder
    const { secret, id, externalId, tenantId, ...filters } = args;
    const query = buildProgressiveQuery(ctx, tenantId, filters);

    // Always get newest record when using filters
    return await query.order("desc").first();
  },
});

/**
 * Server-side create with secret authentication.
 */
export const create = mutation({
  args: {
    secret: v.string(),
    tenantId: v.id("tenants"),
    integrationId: v.id("integrations"),
    dataSourceId: v.id("data_sources"),
    siteId: v.optional(v.id("sites")),
    entityType: entityTypeValidator,
    externalId: v.string(),
    dataHash: v.string(),
    rawData: v.any(),
    normalizedData: v.any(),
  },
  handler: async (ctx, args) => {
    await isValidSecret(args.secret);
    const { secret, ...data } = args;

    const entityId = await ctx.db.insert("entities", {
      ...data,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return await ctx.db.get(entityId);
  },
});

/**
 * Server-side update with secret authentication.
 */
export const update = mutation({
  args: {
    secret: v.string(),
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
    await isValidSecret(args.secret);

    const entity = await ctx.db.get(args.id);
    if (!entity) {
      throw new Error("Entity not found");
    }

    // Update with automatic timestamp
    await ctx.db.patch(args.id, {
      ...args.updates,
      updatedAt: Date.now(),
    });

    return await ctx.db.get(args.id);
  },
});

/**
 * Server-side delete with secret authentication.
 * Hard delete only (entities table doesn't have deletedAt).
 */
export const deleteEntity = mutation({
  args: {
    secret: v.string(),
    id: v.id("entities"),
  },
  handler: async (ctx, args) => {
    await isValidSecret(args.secret);

    const entity = await ctx.db.get(args.id);
    if (!entity) {
      throw new Error("Entity not found");
    }

    await ctx.db.delete(args.id);
    return true;
  },
});
