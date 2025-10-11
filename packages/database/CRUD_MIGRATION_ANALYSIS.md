# CRUD Migration Analysis

This document provides a comprehensive analysis of existing Convex functions that can be replaced by the new generic CRUD functions, and which functions should be kept due to specialized logic.

## Summary

- **Total Replaceable Functions**: 8
- **Functions to Keep**: 11 (specialized logic required)
- **Partially Replaceable**: 2 (can use CRUD as base, but need wrappers)

---

## Entities Module

### ✅ Can Be Replaced

#### `entities/query.ts::list`
- **Replace with**: `entities/crud.ts::list`
- **Current usage**: Basic list with optional integrationId and entityType filters
- **Migration**: Direct replacement - the CRUD version supports the same filters plus pagination

### ❌ Keep (Specialized Logic)

#### `entities/query.ts::getCompaniesWithSite`
- **Reason**: Has custom join logic with sites table, returns enriched data with site linkage info
- **Notes**: This is a view-specific query that can't be generalized

---

## Data Sources Module

### ✅ Can Be Replaced

#### `datasources/query.ts::getDataSource`
- **Replace with**: `datasources/crud.ts::get({ id: "..." })`
- **Current usage**: Get by ID with tenant validation
- **Migration**: Direct replacement

#### `datasources/query.ts::list`
- **Replace with**: `datasources/crud.ts::list`
- **Current usage**: List by integrationId with tenant validation
- **Migration**: Direct replacement - the CRUD version supports more filters plus pagination

#### `datasources/query.ts::getPrimaryByIntegration`
- **Replace with**: `datasources/crud.ts::get({ integrationId: "...", isPrimary: true })`
- **Current usage**: Get primary data source for an integration
- **Migration**: The CRUD get function with filters will return the newest matching record (same behavior)

#### `datasources/mutate.ts::disable`
- **Replace with**: `datasources/crud.ts::deleteDataSource({ id: "...", hard: false })`
- **Current usage**: Soft delete (sets status to inactive and deletedAt)
- **Migration**: Direct replacement - CRUD delete with hard=false does the same thing

#### `datasources/mutate.ts::deleteSiteMapping`
- **Replace with**: `datasources/crud.ts::deleteDataSource({ id: "...", hard: true })`
- **Current usage**: Hard delete a site mapping data source
- **Migration**: Direct replacement

### 🔄 Partially Replaceable

#### `datasources/mutate.ts::updateConfig`
- **Replace with**: `datasources/crud.ts::update`
- **Current usage**: Only updates the config field
- **Notes**: Can be replaced, but might want to keep as a convenience wrapper
- **Migration**: Replace body with call to CRUD update, or delete if direct usage is acceptable

### ❌ Keep (Specialized Logic)

#### `datasources/mutate.ts::enable`
- **Reason**: Re-enables soft-deleted records (clears deletedAt and sets status to active)
- **Notes**: Opposite of delete - specialized business logic

#### `datasources/mutate.ts::createPrimaryForIntegration`
- **Reason**: Creates a primary data source with specific defaults and isPrimary=true
- **Notes**: Specialized creation logic for primary data sources

#### `datasources/mutate.ts::createSiteMapping`
- **Reason**: Has upsert logic - updates existing or creates new site mapping
- **Notes**: Complex conditional logic that can't be generalized

---

## Sites Module

### ✅ Can Be Replaced

#### `sites/query.ts::getSites`
- **Replace with**: `sites/crud.ts::list({})`
- **Current usage**: List all sites for tenant
- **Migration**: Direct replacement - pass empty object or no filters

### 🔄 Partially Replaceable

#### `sites/mutate.ts::updatePSAConfig`
- **Replace with**: `sites/crud.ts::update`
- **Current usage**: Only updates PSA-related fields (psaIntegrationId, psaCompanyId, psaParentCompanyId)
- **Notes**: Can be replaced, but might want to keep as a convenience wrapper
- **Migration**: Replace body with call to CRUD update, or delete if direct usage is acceptable

### ❌ Keep (Specialized Logic)

#### `sites/query.ts::getSiteWithIntegrationsView`
- **Reason**: Complex join logic - fetches site with all linked integrations from multiple tables
- **Notes**: This is a view-specific query that performs multiple queries and data aggregation

#### `sites/mutate.ts::create`
- **Reason**: Has specialized slug generation logic (generateSUUID function)
- **Notes**: Business logic for creating sites with unique slugs

---

## Scheduled Jobs Module

### ✅ Can Be Replaced

#### `scheduledjobs/query.ts::getRecentByDataSource`
- **Replace with**: `scheduledjobs/crud.ts::get({ dataSourceId: "...", status: "failed" })`
- **Current usage**: Gets the most recent failed job for a data source using `.unique()`
- **Migration**: The CRUD get with filters returns `.first()` which gets the newest matching record - similar behavior but slightly different (first vs unique)
- **⚠️ Note**: Original uses `.unique()` which expects 0 or 1 results. CRUD uses `.first()` which gets the first of potentially many. Verify this is acceptable for your use case.

### ❌ Keep (Specialized Logic)

#### `scheduledjobs/query.ts::getFailedCountByDataSource`
- **Reason**: Returns a count, not the records themselves
- **Notes**: Specialized aggregation query - not a CRUD operation

#### `scheduledjobs/mutate.ts::createScheduledJob`
- **Reason**: Has specialized creation logic with defaults and field mapping
- **Notes**: Sets createdBy, scheduledAt, and other fields with specific logic

#### `scheduledjobs/mutate.ts::scheduleJobsByIntegration`
- **Reason**: Batch creation logic - creates multiple jobs from a list of types
- **Notes**: Specialized business logic for scheduling multiple jobs at once

---

## Users Module

### ❌ Keep (All Specialized)

#### `users/query.ts::getCurrentUser`
- **Reason**: Specialized function that returns the currently authenticated user
- **Notes**: Convenience function that just returns the identity from isAuthenticated

#### `users/mutate.ts::updateMyMetadata`
- **Reason**: Specialized function that only updates the current user's metadata field
- **Notes**: Security boundary - ensures users can only update their own metadata

---

## Agents Module

### ℹ️ No Existing Functions

Both `agents/query.ts` and `agents/mutate.ts` are empty files. The new CRUD functions are ready to use without any conflicts.

---

## Migration Priority Recommendations

### High Priority (Safe, Direct Replacements)
1. ✅ `entities/query.ts::list` → `entities/crud.ts::list`
2. ✅ `datasources/query.ts::getDataSource` → `datasources/crud.ts::get`
3. ✅ `datasources/query.ts::list` → `datasources/crud.ts::list`
4. ✅ `datasources/query.ts::getPrimaryByIntegration` → `datasources/crud.ts::get`
5. ✅ `sites/query.ts::getSites` → `sites/crud.ts::list`

### Medium Priority (Verify Behavior)
6. ✅ `scheduledjobs/query.ts::getRecentByDataSource` → `scheduledjobs/crud.ts::get`
   - **⚠️ Action Required**: Verify `.first()` vs `.unique()` behavior is acceptable

### Low Priority (Consider Keeping as Wrappers)
7. 🔄 `datasources/mutate.ts::updateConfig` → Keep as wrapper or migrate
8. 🔄 `sites/mutate.ts::updatePSAConfig` → Keep as wrapper or migrate

### Delete Operations
9. ✅ `datasources/mutate.ts::disable` → `datasources/crud.ts::deleteDataSource`
10. ✅ `datasources/mutate.ts::deleteSiteMapping` → `datasources/crud.ts::deleteDataSource`

---

## Index Cleanup Opportunities

After migration, consider removing these indexes if they're no longer used by the specialized functions:

### Entities
- ✅ Can likely keep all indexes - used by specialized queries

### Data Sources
- ✅ Can likely keep all indexes - used by specialized queries

### Sites
- ⚠️ `by_tenant_and_status` - may be redundant now that we have `by_tenant_status_ordered`
  - **Check**: If no specialized functions use it, consider deprecating

### Agents
- ✅ All indexes are used by CRUD functions

### Scheduled Jobs
- ✅ All indexes are needed

### Users
- ✅ All indexes are needed

---

## Implementation Checklist

- [x] Create all CRUD functions (entities, data_sources, sites, agents, scheduled_jobs, users)
- [x] Add optimized indexes with createdAt for pagination
- [ ] Update codebase references to use CRUD functions (after review)
- [ ] Test pagination behavior in replaced functions
- [ ] Remove old function definitions after migration
- [ ] Run full test suite
- [ ] Update any documentation/API references

---

## Pagination Benefits

All list functions now support pagination via the `paginationOpts` parameter:

```typescript
// Before (no pagination)
const allSites = await ctx.runQuery(api.sites.query.getSites, {});

// After (with pagination)
const sitesPage = await ctx.runQuery(api.sites.crud.list, {
  paginationOpts: { numItems: 50, cursor: null }
});
```

This enables efficient loading of large datasets with cursor-based pagination.
