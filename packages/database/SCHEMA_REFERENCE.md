# Convex Schema Reference

Quick reference for all tables in the Convex database schema.

## Core Tables

### `tenants`
- **Purpose**: Multi-tenant organization data
- **Key Fields**: `name`, `status`, `metadata`
- **Indexes**: `by_status`

### `users`
- **Purpose**: User accounts (linked to Clerk)
- **Key Fields**: `tenantId`, `roleId`, `email`, `name`, `status`, `metadata`
- **Special**: Document `_id` is the Clerk user ID
- **Indexes**: `by_tenant`, `by_email`, `by_status`

### `roles`
- **Purpose**: User roles and permissions
- **Key Fields**: `tenantId` (optional), `name`, `description`, `rights`
- **Special**: `tenantId` null = global role
- **Indexes**: `by_tenant`, `by_name`

### `sites`
- **Purpose**: Customer/client sites
- **Key Fields**: `tenantId`, `name`, `slug`, `status`, `psaIntegrationId`, `psaCompanyId`
- **Indexes**: `by_tenant`, `by_slug`, `by_status`, `by_tenant_and_status`

## Integration Tables

### `integrations`
- **Purpose**: Available integrations (HaloPSA, Sophos, etc.)
- **Key Fields**: `name`, `description`, `category`, `supportedTypes`, `isActive`
- **Special**: Document `_id` is the integration slug
- **Indexes**: `by_category`, `by_is_active`

### `data_sources`
- **Purpose**: Configured integration instances
- **Key Fields**: `tenantId`, `integrationId`, `siteId`, `status`, `config`, `credentialExpirationAt`
- **Indexes**: `by_tenant`, `by_integration`, `by_site`, `by_status`, `by_external_id`

### `data_source_to_site`
- **Purpose**: Many-to-many mapping of data sources to sites
- **Key Fields**: `tenantId`, `dataSourceId`, `siteId`
- **Indexes**: `by_data_source`, `by_site`, `by_tenant`

## Agent Tables

### `agents`
- **Purpose**: MSPByte agents installed on client devices
- **Key Fields**: `tenantId`, `siteId`, `guid`, `hostname`, `platform`, `version`, `lastCheckinAt`
- **Indexes**: `by_tenant`, `by_site`, `by_guid`, `by_last_checkin`

### `agent_api_logs`
- **Purpose**: Logs of agent API calls
- **Key Fields**: `tenantId`, `siteId`, `agentId`, `endpoint`, `method`, `statusCode`, `timeElapsedMs`
- **Indexes**: `by_tenant`, `by_site`, `by_agent`, `by_created_at`

## Entity System

### `entities`
- **Purpose**: Normalized data from integrations (devices, tickets, etc.)
- **Key Fields**: `tenantId`, `integrationId`, `dataSourceId`, `siteId`, `entityType`, `externalId`, `dataHash`, `rawData`, `normalizedData`
- **Indexes**: `by_tenant`, `by_integration`, `by_data_source`, `by_site`, `by_type`, `by_external_id`, `by_type_and_external_id`

### `global_entities`
- **Purpose**: Tenant-independent entities from integrations
- **Key Fields**: `integrationId`, `entityType`, `externalId`, `dataHash`, `rawData`, `normalizedData`
- **Indexes**: `by_integration`, `by_type`, `by_external_id`

### `entity_relationships`
- **Purpose**: Relationships between entities
- **Key Fields**: `tenantId`, `parentEntityId`, `childEntityId`, `relationshipType`, `metadata`
- **Indexes**: `by_tenant`, `by_parent`, `by_child`, `by_type`

## Jobs & Events

### `scheduled_jobs`
- **Purpose**: Background job queue
- **Key Fields**: `tenantId`, `integrationId`, `dataSourceId`, `action`, `payload`, `status`, `scheduledAt`, `attempts`, `nextRetryAt`
- **Indexes**: `by_status`, `by_scheduled_at`, `by_tenant`, `by_integration`, `by_next_retry`

### `events_log`
- **Purpose**: Event processing log
- **Key Fields**: `tenantId`, `entityId`, `eventType`, `status`, `payload`, `processedAt`, `retryCount`
- **Indexes**: `by_tenant`, `by_entity`, `by_status`, `by_type`

## Monitoring & Logging

### `health_checks`
- **Purpose**: Health monitoring for resources
- **Key Fields**: `tenantId`, `resourceType`, `resourceId`, `status`, `failureCount`, `lastCheckAt`, `errorMessage`
- **Indexes**: `by_tenant`, `by_resource`, `by_status`

### `api_logs`
- **Purpose**: Generic API request/response logs
- **Key Fields**: `url`, `method`, `statusCode`, `durationMs`, `body`, `responseBody`, `expiresAt`
- **Special**: Auto-cleanup based on `expiresAt`
- **Indexes**: `by_created_at`, `by_expires_at`

### `audit_log`
- **Purpose**: Audit trail for data changes
- **Key Fields**: `tenantId`, `userId`, `tableName`, `recordId`, `action`, `changes`
- **Indexes**: `by_tenant`, `by_user`, `by_table`, `by_created_at`

## Billing & Pricing

### `integration_pricing_tiers`
- **Purpose**: Pricing tiers for integrations
- **Key Fields**: `tenantId`, `integrationId`, `name`, `description`, `unitCost`, `effectiveFrom`, `effectiveUntil`
- **Indexes**: `by_tenant`, `by_integration`, `by_effective`

### `tenant_bills`
- **Purpose**: Bills for tenants
- **Key Fields**: `tenantId`, `periodStart`, `periodEnd`, `status`, `total`, `finalizedAt`, `paidAt`
- **Indexes**: `by_tenant`, `by_period`, `by_status`

### `tenant_bill_line_items`
- **Purpose**: Line items on bills
- **Key Fields**: `tenantId`, `billId`, `integrationId`, `pricingTierId`, `description`, `units`, `unitCost`, `total`
- **Indexes**: `by_tenant`, `by_bill`, `by_integration`

### `tenant_billing_adjustments`
- **Purpose**: Billing credits/debits/discounts
- **Key Fields**: `tenantId`, `integrationId`, `type`, `amount`, `reason`, `effectiveFrom`, `effectiveTo`, `createdBy`
- **Indexes**: `by_tenant`, `by_integration`, `by_effective`

---

## Field Naming Conventions

### Timestamp Fields
All timestamp fields use **milliseconds since epoch** (number):
- `createdAt` - When the record was created
- `updatedAt` - When the record was last updated
- `deletedAt` - When the record was soft-deleted (optional)
- `*At` - Any other timestamp field (e.g., `scheduledAt`, `lastCheckinAt`)

### Reference Fields (IDs)
- `tenantId` - Reference to `tenants` table
- `userId` - Reference to `users` table
- `siteId` - Reference to `sites` table
- `integrationId` - Reference to `integrations` table
- `dataSourceId` - Reference to `data_sources` table
- etc.

### Status Fields
Common status enums:
- Sites: `"active"` | `"inactive"` | `"archived"`
- Users: `"active"` | `"inactive"` | `"pending"`
- Data Sources: `"active"` | `"inactive"` | `"error"`
- Jobs: `"pending"` | `"running"` | `"completed"` | `"failed"`
- Bills: `"draft"` | `"finalized"` | `"paid"` | `"cancelled"`

---

## Migration Notes

### Supabase → Convex Changes

1. **Field Names**: `snake_case` → `camelCase`
   - `created_at` → `createdAt`
   - `tenant_id` → `tenantId`
   - `psa_integration_id` → `psaIntegrationId`

2. **Timestamps**: ISO strings → milliseconds
   - Supabase: `"2024-01-01T00:00:00.000Z"`
   - Convex: `1704067200000`

3. **IDs**:
   - Supabase: UUIDs as strings
   - Convex: Convex IDs (e.g., `Id<"tenants">`)
   - Special cases: Users use Clerk ID, Integrations use slug

4. **Views**:
   - Supabase views → Convex computed queries
   - Example: `sites_view` → `getSitesView()` query

5. **Nullable Fields**:
   - Supabase: `null`
   - Convex: `v.optional()` - field can be undefined

---

## Quick Start Examples

### Query a table
```typescript
const sites = await ctx.db.query("sites")
  .filter(q => q.eq(q.field("tenantId"), tenantId))
  .collect();
```

### Get by ID
```typescript
const site = await ctx.db.get(siteId);
```

### Insert
```typescript
const siteId = await ctx.db.insert("sites", {
  tenantId,
  name: "Acme Corp",
  slug: "acme-corp",
  status: "active",
  createdAt: Date.now(),
  updatedAt: Date.now(),
});
```

### Update
```typescript
await ctx.db.patch(siteId, {
  name: "Acme Corporation",
  updatedAt: Date.now(),
});
```

### Delete (soft)
```typescript
await ctx.db.patch(siteId, {
  deletedAt: Date.now(),
  updatedAt: Date.now(),
});
```

---

For more details, see:
- `schema.ts` - Full schema definitions
- `sites.ts` - Example queries and mutations
- `MIGRATION_GUIDE.md` - Step-by-step migration guide
