import { v } from "convex/values";
import { useAuthQuery, useAuthMutation } from "./helper";
import type {
  SiteWithDetails,
  PaginatedResult,
  PaginationState,
} from "./types";
import { buildPaginatedQuery, generateSlug, now } from "./utils";
import { Doc, Id } from "./_generated/dataModel";

/**
 * Sites Queries and Mutations
 *
 * This module provides CRUD operations for sites with authentication.
 *
 * Migration Status:
 * - [x] Read operations (queries)
 * - [ ] Create operations (mutations) - TODO
 * - [ ] Update operations (mutations) - TODO
 * - [ ] Delete operations (mutations) - TODO
 */

// ============================================================================
// READ OPERATIONS (QUERIES) - COMPLETE
// ============================================================================

/**
 * Get all sites with pagination, filtering, and sorting
 *
 * Replaces: ORM.getRows('sites_view', { pagination: state })
 *
 * @example
 * const sites = useQuery(api.sites.getSites, {
 *   page: 0,
 *   pageSize: 10,
 *   search: "acme",
 *   sorting: { name: "asc" }
 * });
 */
export const getSites = useAuthQuery({
  args: {
    page: v.optional(v.number()),
    pageSize: v.optional(v.number()),
    search: v.optional(v.string()),
    sorting: v.optional(v.any()),
    tenantId: v.optional(v.id("tenants")),
  },
  handler: async (ctx, args): Promise<PaginatedResult<SiteWithDetails>> => {
    const page = args.page ?? 0;
    const pageSize = args.pageSize ?? 100;
    const offset = page * pageSize;

    let query = ctx.db.query("sites");

    // Filter by tenant if provided
    if (args.tenantId) {
      query = query.filter((q) => q.eq(q.field("tenantId"), args.tenantId));
    }

    // Apply search across name and slug
    if (args.search) {
      const searchLower = args.search.toLowerCase();
      query = query.filter((q) =>
        q.or(
          q.eq(q.field("name"), searchLower),
          q.eq(q.field("slug"), searchLower)
        )
      );
    }

    // Apply sorting
    const sortField = args.sorting ? Object.keys(args.sorting)[0] : "name";
    const sortDir = args.sorting?.[sortField] || "asc";
    const orderedQuery = query.order(sortDir);

    // Get paginated results
    const allResults = await orderedQuery.collect();
    const total = allResults.length;
    const rows = allResults.slice(offset, offset + pageSize);

    // Enhance with PSA integration details
    const enhancedRows: SiteWithDetails[] = await Promise.all(
      rows.map(async (site) => {
        let psaIntegrationName: string | undefined;

        if (site.psaIntegrationId) {
          const integration = await ctx.db.get(site.psaIntegrationId);
          psaIntegrationName = integration?.name;
        }

        return {
          ...site,
          psaIntegrationName,
        };
      })
    );

    return {
      rows: enhancedRows,
      total,
      page,
      pageSize,
      hasMore: offset + pageSize < total,
    };
  },
});

/**
 * Get a single site by ID
 *
 * Replaces: ORM.getRow('sites_view', { filters: [['id', 'eq', id]] })
 */
export const getSiteById = useAuthQuery({
  args: {
    id: v.id("sites"),
  },
  handler: async (ctx, args): Promise<SiteWithDetails | null> => {
    const site = await ctx.db.get(args.id);
    if (!site) return null;

    let psaIntegrationName: string | undefined;

    if (site.psaIntegrationId) {
      const integration = await ctx.db.get(site.psaIntegrationId);
      psaIntegrationName = integration?.name;
    }

    return {
      ...site,
      psaIntegrationName,
    };
  },
});

/**
 * Get a single site by slug
 *
 * Replaces: ORM.getRow('sites_view', { filters: [['slug', 'eq', slug]] })
 */
export const getSiteBySlug = useAuthQuery({
  args: {
    slug: v.string(),
  },
  handler: async (ctx, args): Promise<SiteWithDetails | null> => {
    const site = await ctx.db
      .query("sites")
      .filter((q) => q.eq(q.field("slug"), args.slug))
      .first();

    if (!site) return null;

    let psaIntegrationName: string | undefined;

    if (site.psaIntegrationId) {
      const integration = await ctx.db.get(site.psaIntegrationId);
      psaIntegrationName = integration?.name;
    }

    return {
      ...site,
      psaIntegrationName,
    };
  },
});

/**
 * Get sites by tenant
 */
export const getSitesByTenant = useAuthQuery({
  args: {
    tenantId: v.id("tenants"),
  },
  handler: async (ctx, args): Promise<Doc<"sites">[]> => {
    return await ctx.db
      .query("sites")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .collect();
  },
});

// ============================================================================
// WRITE OPERATIONS (MUTATIONS) - TODO: Complete after read operations work
// ============================================================================

/**
 * Create a new site
 *
 * TODO: Implement this mutation
 *
 * Replaces: ORM.insertRows('sites', { rows: [{ ... }] })
 *
 * @example
 * const siteId = useMutation(api.sites.createSite, {
 *   tenantId,
 *   name: "Acme Corp",
 *   psaCompanyId: "123"
 * });
 */
/*
export const createSite = useAuthMutation({
  args: {
    tenantId: v.id("tenants"),
    name: v.string(),
    psaIntegrationId: v.optional(v.id("integrations")),
    psaCompanyId: v.optional(v.string()),
    psaParentCompanyId: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args): Promise<Id<"sites">> => {
    const slug = generateSlug(args.name);
    const timestamp = now();

    return await ctx.db.insert("sites", {
      tenantId: args.tenantId,
      name: args.name,
      slug,
      status: "active",
      psaIntegrationId: args.psaIntegrationId,
      psaCompanyId: args.psaCompanyId,
      psaParentCompanyId: args.psaParentCompanyId,
      metadata: args.metadata,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  },
});
*/

/**
 * Update a site
 *
 * TODO: Implement this mutation
 *
 * Replaces: ORM.updateRow('sites', { id, row: { ... } })
 */
/*
export const updateSite = useAuthMutation({
  args: {
    id: v.id("sites"),
    name: v.optional(v.string()),
    status: v.optional(v.union(v.literal("active"), v.literal("inactive"), v.literal("archived"))),
    psaIntegrationId: v.optional(v.id("integrations")),
    psaCompanyId: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args): Promise<void> => {
    const { id, ...updates } = args;

    await ctx.db.patch(id, {
      ...updates,
      updatedAt: now(),
    });
  },
});
*/

/**
 * Delete a site (soft delete)
 *
 * TODO: Implement this mutation
 *
 * Replaces: ORM.updateRow('sites', { id, row: { deleted_at: new Date() } })
 */
/*
export const deleteSite = useAuthMutation({
  args: {
    id: v.id("sites"),
  },
  handler: async (ctx, args): Promise<void> => {
    await ctx.db.patch(args.id, {
      status: "archived",
      deletedAt: now(),
      updatedAt: now(),
    });
  },
});
*/
