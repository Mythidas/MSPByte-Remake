/**
 * Example usage documentation for the new dynamic CRUD system.
 * Uses TypeScript filtering to bypass Convex's limited database filters.
 *
 * See: packages/database/convex/helpers/dynamicCrud.ts
 *
 * The dynamic CRUD functions (dynamicList and dynamicGet) are exported from
 * dynamicCrud.ts and can be called directly from your frontend or used within
 * other Convex functions through the API.
 *
 * USAGE FROM FRONTEND:
 * ====================
 * import { api } from 'convex/_generated/api';
 *
 * // Example 1: Simple list with default by_tenant index
 * const sites = await client.query(api.helpers.dynamicCrud.dynamicList, {
 *   tableName: "sites",
 *   filters: {
 *     status: "active",
 *   },
 * });
 *
 * // Example 2: Custom index with complex filters
 * const agents = await client.query(api.helpers.dynamicCrud.dynamicList, {
 *   tableName: "agents",
 *   index: {
 *     name: "by_site",
 *     params: { siteId: "..." },
 *   },
 *   filters: {
 *     status: "online",
 *     platform: { in: ["windows", "linux"] },
 *   },
 * });
 *
 * // Example 3: Logical operators (AND, OR, NOT)
 * const jobs = await client.query(api.helpers.dynamicCrud.dynamicList, {
 *   tableName: "scheduled_jobs",
 *   filters: {
 *     or: [
 *       { status: "failed" },
 *       { status: "pending", attempts: { gte: 3 } },
 *     ],
 *   },
 * });
 *
 * // Example 4: String operations
 * const searchResults = await client.query(api.helpers.dynamicCrud.dynamicList, {
 *   tableName: "sites",
 *   filters: {
 *     name: { contains: "acme" },
 *     status: { ne: "archived" },
 *   },
 * });
 *
 * // Example 5: Complex nested conditions
 * const now = Date.now();
 * const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
 * const dataSources = await client.query(api.helpers.dynamicCrud.dynamicList, {
 *   tableName: "data_sources",
 *   filters: {
 *     and: [
 *       { status: "active" },
 *       {
 *         or: [
 *           { credentialExpirationAt: { lt: now + 7 * 24 * 60 * 60 * 1000 } },
 *           { lastSyncAt: { lt: sevenDaysAgo } },
 *           { lastSyncAt: undefined },
 *         ],
 *       },
 *     ],
 *   },
 * });
 *
 * // Example 6: Get single record with dynamicGet
 * const agent = await client.query(api.helpers.dynamicCrud.dynamicGet, {
 *   tableName: "agents",
 *   index: {
 *     name: "by_guid",
 *     params: { guid: "abc-123" },
 *   },
 *   filters: {
 *     status: { ne: "offline" },
 *   },
 * });
 *
 * SUPPORTED FILTER OPERATORS:
 * ============================
 *
 * Comparison: gt, gte, lt, lte, eq, ne
 * Arrays: in, nin, includes
 * Strings: contains, startsWith, endsWith, regex
 * Logical: and, or, not
 *
 * BENEFITS:
 * =========
 * ✅ Single function queries ANY table
 * ✅ Unlimited filter complexity
 * ✅ Index-first approach for performance
 * ✅ Automatic tenant isolation
 * ✅ Type-safe table names
 * ✅ No schema changes required
 */

export {};
