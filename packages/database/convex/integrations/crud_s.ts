import { v } from "convex/values";
import { query } from "../_generated/server.js";
import { isValidSecret } from "../helpers/validators.js";
import type { Query } from "convex/server";
import type { DataModel, Id } from "../_generated/dataModel.js";

// ============================================================================
// SHARED HELPER
// ============================================================================

/**
 * Builds a progressive query for integrations based on provided filters.
 * Note: tenantId is optional for server queries (allows cross-tenant operations)
 */
function buildProgressiveQuery(
  ctx: any,
  filters: {
    slug?: string;
    category?: string;
    isActive?: boolean;
  }
): Query<DataModel["integrations"]> {
  const { slug, category, isActive } = filters;

  // Progressive index selection
  if (slug) {
    return ctx.db
      .query("integrations")
      .withIndex("by_slug", (q: any) => q.eq("slug", slug));
  } else if (category) {
    return ctx.db
      .query("integrations")
      .withIndex("by_category", (q: any) => q.eq("category", category));
  } else if (isActive !== undefined) {
    return ctx.db
      .query("integrations")
      .withIndex("by_is_active")
      .filter((q: any) => q.eq(q.field("isActive"), isActive));
  } else {
    // No filters - return all integrations
    return ctx.db.query("integrations");
  }
}

// ============================================================================
// SERVER CRUD OPERATIONS
// ============================================================================

/**
 * Server-side get with secret authentication.
 * Supports both direct ID lookup and filter-based queries.
 */
export const get = query({
  args: {
    secret: v.string(),
    id: v.optional(v.id("integrations")),
    slug: v.optional(v.string()),
    category: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await isValidSecret(args.secret);

    // Direct ID lookup mode
    if (args.id) {
      return await ctx.db.get(args.id);
    }

    // Filter-based mode - use progressive query builder
    const { secret, id, ...filters } = args;
    const query = buildProgressiveQuery(ctx, filters);

    // For slug lookups, use unique() instead of first()
    if (args.slug) {
      return await query.unique();
    }

    // Otherwise get newest record when using filters
    return await query.order("desc").first();
  },
});
