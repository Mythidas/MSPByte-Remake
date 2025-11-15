# HaloPSA Integration - Implementation Notes

This document outlines the Convex mutations and queries that need to be implemented to complete the HaloPSA integration functionality.

## Overview

The HaloPSA integration pages have been built with placeholder TODO comments where Convex mutations are needed. This document describes what each mutation should do.

## Required Convex Mutations

### 1. Data Source Management

#### `api.datasources.mutate.createOrUpdate`

**Purpose**: Create a new data source or update an existing one with HaloPSA credentials

**Args**:
```typescript
{
  integrationId: Id<"integrations">
  config: {
    url: string
    clientId: string
    clientSecret: string
  }
  credentialExpirationAt?: number
}
```

**Logic**:
1. Check if a primary data source already exists for this integration and tenant
2. If exists, update it with new config and credentialExpirationAt
3. If not, create a new primary data source using `createPrimaryForIntegration` pattern
4. Set status to "active"
5. **Automatically schedule sync jobs for ALL `supportedTypes`** defined in the integration
   - Use `api.scheduledjobs.mutate.scheduleJobsByIntegration`
   - Respect the `rateMinutes` configured for each entity type
   - No user input needed - fully automated
6. Return the data source

**Used in**: `apps/frontend/app/secure/default/integrations/halopsa/setup/page.tsx`

---

#### `api.datasources.mutate.testConnection`

**Purpose**: Validate HaloPSA credentials by making a test API call

**Args**:
```typescript
{
  url: string
  clientId: string
  clientSecret: string
}
```

**Logic**:
1. Use the credentials to authenticate with HaloPSA API
2. Make a simple API call (e.g., GET /api/version or GET /api/company?count=1)
3. If successful, return success response
4. If failed, throw error with message

**Used in**: `apps/frontend/app/secure/default/integrations/halopsa/setup/page.tsx`

**Note**: This should be an **action** (not mutation) since it makes external API calls

---

### 2. Sync Management

#### `api.scheduledjobs.mutate.triggerManualSync`

**Purpose**: Trigger a manual sync for a specific entity type

**Args**:
```typescript
{
  dataSourceId: Id<"data_sources">
  entityType: string  // e.g., "companies", "endpoints"
}
```

**Logic**:
1. Verify data source exists and is active
2. Create a new scheduled job with:
   - action: `sync.${entityType}`
   - status: "pending"
   - priority: 1 (high priority for manual triggers)
   - scheduledAt: now
3. Return the created job

**Used in**: `apps/frontend/app/secure/default/integrations/halopsa/sync/page.tsx`

---

#### `api.datasources.mutate.pauseSync`

**Purpose**: Pause all syncing for a data source

**Args**:
```typescript
{
  dataSourceId: Id<"data_sources">
}
```

**Logic**:
1. Update data source status to "inactive"
2. Optionally: cancel any pending scheduled jobs for this data source
3. Return success

**Used in**: `apps/frontend/app/secure/default/integrations/halopsa/sync/page.tsx`

**Note**: This already exists as `api.datasources.mutate.disable`

---

#### `api.datasources.mutate.resumeSync`

**Purpose**: Resume syncing for a paused data source

**Args**:
```typescript
{
  dataSourceId: Id<"data_sources">
}
```

**Logic**:
1. Update data source status to "active"
2. Optionally: schedule immediate sync jobs for all entity types
3. Return success

**Used in**: `apps/frontend/app/secure/default/integrations/halopsa/sync/page.tsx`

**Note**: This already exists as `api.datasources.mutate.enable`

---

#### `api.scheduledjobs.mutate.retryJob`

**Purpose**: Retry a failed scheduled job

**Args**:
```typescript
{
  jobId: Id<"scheduled_jobs">
}
```

**Logic**:
1. Get the failed job
2. Reset its status to "pending"
3. Reset attempts counter (or increment based on business logic)
4. Set nextRetryAt to now
5. Return updated job

**Used in**: `apps/frontend/app/secure/default/integrations/halopsa/sync/page.tsx`

---

### 3. Company Mapping / Site Linking

#### `api.sites.mutate.linkToPSACompany`

**Purpose**: Link an existing MSPByte site to a HaloPSA company

**Args**:
```typescript
{
  siteId: Id<"sites">
  integrationId: Id<"integrations">
  companyExternalId: string
  companyExternalParentId?: string
  integrationName: string
}
```

**Logic**:
1. Verify site exists and user has access
2. Update site with PSA fields:
   ```typescript
   {
     psaCompanyId: companyExternalId
     psaIntegrationId: integrationId
     psaParentCompanyId: companyExternalParentId
     psaIntegrationName: integrationName
     updatedAt: Date.now()
   }
   ```
3. Return updated site

**Used in**: `apps/frontend/app/secure/default/integrations/halopsa/companies/page.tsx`

---

#### `api.sites.mutate.unlinkFromPSACompany`

**Purpose**: Unlink a site from its HaloPSA company

**Args**:
```typescript
{
  siteId: Id<"sites">
}
```

**Logic**:
1. Verify site exists and user has access
2. Clear PSA fields:
   ```typescript
   {
     psaCompanyId: undefined
     psaIntegrationId: undefined
     psaParentCompanyId: undefined
     psaIntegrationName: undefined
     updatedAt: Date.now()
   }
   ```
3. Return updated site

**Used in**: `apps/frontend/app/secure/default/integrations/halopsa/companies/page.tsx`

---

#### `api.sites.mutate.createFromPSACompany`

**Purpose**: Create a new MSPByte site from a HaloPSA company and link them

**Args**:
```typescript
{
  name: string
  integrationId: Id<"integrations">
  companyExternalId: string
  companyExternalParentId?: string
  integrationName: string
}
```

**Logic**:
1. Create a new site using existing site creation logic
2. Generate slug from name
3. Set PSA fields in the new site
4. Return created site

**Used in**: `apps/frontend/app/secure/default/integrations/halopsa/companies/page.tsx`

---

## Existing Mutations That Can Be Used

The following mutations already exist and can be used as-is:

1. **`api.helpers.orm.list`** - Used throughout for querying data
2. **`api.integrations.query_s.getBySlug`** - Get integration by slug
3. **`api.datasources.mutate.disable`** - Can be used for pauseSync
4. **`api.datasources.mutate.enable`** - Can be used for resumeSync
5. **`api.datasources.mutate.createPrimaryForIntegration`** - Base for createOrUpdate
6. **`api.scheduledjobs.mutate.scheduleJobsByIntegration`** - Schedule initial sync jobs

## Schema Updates Needed

The sites table may need these optional fields added if they don't exist:

```typescript
sites: defineTable({
  // ... existing fields
  psaCompanyId: v.optional(v.string()),
  psaIntegrationId: v.optional(v.id("integrations")),
  psaParentCompanyId: v.optional(v.string()),
  psaIntegrationName: v.optional(v.string()),
})
```

## Next Steps

1. Implement the mutations listed above in their respective Convex directories
2. Update the frontend pages to call the real mutations instead of the TODO placeholders
3. Test the full integration flow:
   - Setup wizard → Create data source
   - Overview → Display stats
   - Sync Management → Trigger syncs, view jobs
   - Company Mapping → Link/unlink sites

## File Locations

- **Mutations to add**: `/packages/database/convex/datasources/mutate.ts`
- **Site mutations**: Create `/packages/database/convex/sites/mutate.ts`
- **Job mutations**: `/packages/database/convex/scheduledjobs/mutate.ts`
- **Actions for API calls**: Create `/packages/database/convex/datasources/actions.ts`
