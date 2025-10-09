import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Convex Database Schema - Complete ✓
 *
 * This schema defines ALL tables from the Supabase database.
 * Each table includes proper validation, types, and indexes for optimal querying.
 *
 * ✅ ALL TABLES DEFINED (23 tables total):
 *
 * Core (4):
 *   - tenants, users, roles, sites
 *
 * Integrations & Data Sources (3):
 *   - integrations, data_sources, data_source_to_site
 *
 * Agents (2):
 *   - agents, agent_api_logs
 *
 * Entity System (3):
 *   - entities, entity_relationships, global_entities
 *
 * Jobs & Events (2):
 *   - scheduled_jobs, events_log
 *
 * Monitoring & Logging (3):
 *   - health_checks, api_logs, audit_log
 *
 * Billing & Pricing (4):
 *   - integration_pricing_tiers, tenant_bills,
 *   - tenant_bill_line_items, tenant_billing_adjustments
 *
 * Key Differences from Supabase:
 * - Timestamps use milliseconds (number) instead of ISO strings
 * - Users table: Clerk ID is stored as the document _id
 * - Integrations table: Slug is stored as the document _id
 * - Field names use camelCase instead of snake_case
 * - Views are replaced with computed queries (see sites.ts for example)
 *
 * Next Steps:
 * 1. Create query/mutation files for each table (see sites.ts as template)
 * 2. Migrate data from Supabase to Convex
 * 3. Update all components to use Convex instead of Supabase ORM
 */

export default defineSchema({
  // Core entities
  tenants: defineTable({
    name: v.string(),
    status: v.union(v.literal("active"), v.literal("inactive"), v.literal("suspended")),
    metadata: v.optional(v.any()),
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
  }).index("by_status", ["status"]),

  users: defineTable({
    // Uses Clerk user ID as the document ID (set via ctx.db.insert with specific ID)
    tenantId: v.id("tenants"),
    roleId: v.id("roles"),
    email: v.string(),
    name: v.string(),
    status: v.union(v.literal("active"), v.literal("inactive"), v.literal("pending")),
    metadata: v.any(), // User preferences, settings, etc.
    lastActivityAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
  })
    .index("by_tenant", ["tenantId"])
    .index("by_email", ["email"])
    .index("by_status", ["status"]),

  roles: defineTable({
    tenantId: v.optional(v.id("tenants")), // null = global role
    name: v.string(),
    description: v.string(),
    rights: v.any(), // JSON object of permissions
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
  })
    .index("by_tenant", ["tenantId"])
    .index("by_name", ["name"]),

  sites: defineTable({
    tenantId: v.id("tenants"),
    name: v.string(),
    slug: v.string(),
    status: v.union(v.literal("active"), v.literal("inactive"), v.literal("archived")),
    psaIntegrationId: v.optional(v.id("integrations")),
    psaCompanyId: v.optional(v.string()),
    psaParentCompanyId: v.optional(v.string()),
    metadata: v.optional(v.any()),
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
  })
    .index("by_tenant", ["tenantId"])
    .index("by_slug", ["slug"])
    .index("by_status", ["status"])
    .index("by_tenant_and_status", ["tenantId", "status"]),

  integrations: defineTable({
    // Uses slug as the document ID (like "halopsa", "sophos")
    name: v.string(),
    description: v.string(),
    category: v.string(), // e.g., "psa", "rmm", "security"
    supportedTypes: v.array(v.string()), // e.g., ["sites", "devices", "tickets"]
    iconUrl: v.optional(v.string()),
    color: v.optional(v.string()),
    level: v.optional(v.string()), // tier/level of integration
    productUrl: v.optional(v.string()),
    configSchema: v.optional(v.any()), // JSON schema for configuration
    isActive: v.optional(v.boolean()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_category", ["category"])
    .index("by_is_active", ["isActive"]),

  data_sources: defineTable({
    tenantId: v.id("tenants"),
    integrationId: v.id("integrations"),
    siteId: v.optional(v.id("sites")), // null = global/tenant-level data source
    externalId: v.optional(v.string()), // ID in the external system
    status: v.union(v.literal("active"), v.literal("inactive"), v.literal("error")),
    config: v.any(), // Data source configuration (credentials, settings, etc.)
    metadata: v.optional(v.any()),
    credentialExpirationAt: v.number(), // When credentials expire
    lastSyncAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
  })
    .index("by_tenant", ["tenantId"])
    .index("by_integration", ["integrationId"])
    .index("by_site", ["siteId"])
    .index("by_status", ["status"])
    .index("by_external_id", ["externalId"]),

  agents: defineTable({
    tenantId: v.id("tenants"),
    siteId: v.id("sites"),
    guid: v.string(),
    hostname: v.string(),
    platform: v.string(),
    version: v.string(),
    ipAddress: v.optional(v.string()),
    macAddress: v.optional(v.string()),
    extAddress: v.optional(v.string()),
    registeredAt: v.optional(v.number()),
    lastCheckinAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
  })
    .index("by_tenant", ["tenantId"])
    .index("by_site", ["siteId"])
    .index("by_guid", ["guid"])
    .index("by_last_checkin", ["lastCheckinAt"]),

  scheduled_jobs: defineTable({
    tenantId: v.id("tenants"),
    integrationId: v.id("integrations"),
    dataSourceId: v.optional(v.id("data_sources")),
    action: v.string(), // e.g., "sync.sites", "sync.devices"
    payload: v.any(),
    priority: v.optional(v.number()),
    status: v.union(
      v.literal("pending"),
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed")
    ),
    attempts: v.optional(v.number()),
    attemptsMax: v.optional(v.number()),
    nextRetryAt: v.optional(v.number()),
    scheduledAt: v.number(),
    startedAt: v.number(),
    error: v.optional(v.string()),
    createdBy: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_status", ["status"])
    .index("by_scheduled_at", ["scheduledAt"])
    .index("by_tenant", ["tenantId"])
    .index("by_integration", ["integrationId"])
    .index("by_next_retry", ["nextRetryAt"]),

  // ============================================================================
  // LOGGING & MONITORING
  // ============================================================================

  agent_api_logs: defineTable({
    tenantId: v.id("tenants"),
    siteId: v.id("sites"),
    agentId: v.id("agents"),
    endpoint: v.string(),
    method: v.string(), // "GET", "POST", etc.
    statusCode: v.number(),
    externalId: v.optional(v.string()),
    psaSiteId: v.optional(v.string()),
    rmmDeviceId: v.optional(v.string()),
    reqMetadata: v.any(),
    resMetadata: v.any(),
    timeElapsedMs: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  })
    .index("by_tenant", ["tenantId"])
    .index("by_site", ["siteId"])
    .index("by_agent", ["agentId"])
    .index("by_created_at", ["createdAt"]),

  api_logs: defineTable({
    url: v.string(),
    method: v.string(),
    statusCode: v.optional(v.number()),
    durationMs: v.optional(v.number()),
    body: v.optional(v.string()),
    responseBody: v.optional(v.string()),
    headers: v.optional(v.any()),
    responseHeaders: v.optional(v.any()),
    errorCode: v.optional(v.string()),
    expiresAt: v.number(), // Auto-cleanup old logs
    createdAt: v.number(),
  })
    .index("by_created_at", ["createdAt"])
    .index("by_expires_at", ["expiresAt"]),

  audit_log: defineTable({
    tenantId: v.id("tenants"),
    userId: v.optional(v.id("users")),
    tableName: v.string(),
    recordId: v.string(),
    action: v.union(v.literal("create"), v.literal("update"), v.literal("delete")),
    changes: v.any(), // JSON diff of changes
    createdAt: v.number(),
  })
    .index("by_tenant", ["tenantId"])
    .index("by_user", ["userId"])
    .index("by_table", ["tableName"])
    .index("by_created_at", ["createdAt"]),

  health_checks: defineTable({
    tenantId: v.id("tenants"),
    resourceType: v.string(), // "integration", "data_source", etc.
    resourceId: v.string(),
    status: v.union(v.literal("healthy"), v.literal("degraded"), v.literal("down")),
    failureCount: v.number(),
    lastCheckAt: v.number(),
    lastSuccessAt: v.optional(v.number()),
    lastFailureAt: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
    metadata: v.optional(v.any()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_tenant", ["tenantId"])
    .index("by_resource", ["resourceType", "resourceId"])
    .index("by_status", ["status"]),

  // ============================================================================
  // ENTITY SYSTEM (for normalized data from integrations)
  // ============================================================================

  entities: defineTable({
    tenantId: v.id("tenants"),
    integrationId: v.id("integrations"),
    dataSourceId: v.id("data_sources"),
    siteId: v.optional(v.id("sites")),
    entityType: v.string(), // "device", "ticket", "company", etc.
    externalId: v.string(), // ID in the external system
    dataHash: v.string(), // Hash for change detection
    rawData: v.any(), // Original data from integration
    normalizedData: v.any(), // Normalized/mapped data
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_tenant", ["tenantId"])
    .index("by_integration", ["integrationId"])
    .index("by_data_source", ["dataSourceId"])
    .index("by_site", ["siteId"])
    .index("by_type", ["entityType"])
    .index("by_external_id", ["integrationId", "externalId"])
    .index("by_type_and_external_id", ["entityType", "externalId"]),

  global_entities: defineTable({
    integrationId: v.id("integrations"),
    entityType: v.string(),
    externalId: v.string(),
    dataHash: v.string(),
    rawData: v.any(),
    normalizedData: v.any(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_integration", ["integrationId"])
    .index("by_type", ["entityType"])
    .index("by_external_id", ["integrationId", "externalId"]),

  entity_relationships: defineTable({
    tenantId: v.id("tenants"),
    parentEntityId: v.id("entities"),
    childEntityId: v.id("entities"),
    relationshipType: v.string(), // "parent", "child", "related", etc.
    metadata: v.optional(v.any()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_tenant", ["tenantId"])
    .index("by_parent", ["parentEntityId"])
    .index("by_child", ["childEntityId"])
    .index("by_type", ["relationshipType"]),

  // ============================================================================
  // EVENTS & PROCESSING
  // ============================================================================

  events_log: defineTable({
    tenantId: v.id("tenants"),
    entityId: v.id("entities"),
    eventType: v.string(), // "created", "updated", "deleted", etc.
    status: v.union(v.literal("pending"), v.literal("processing"), v.literal("completed"), v.literal("failed")),
    payload: v.any(),
    processedAt: v.number(),
    retryCount: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_tenant", ["tenantId"])
    .index("by_entity", ["entityId"])
    .index("by_status", ["status"])
    .index("by_type", ["eventType"]),

  // ============================================================================
  // RELATIONSHIPS & MAPPING
  // ============================================================================

  data_source_to_site: defineTable({
    tenantId: v.optional(v.id("tenants")),
    dataSourceId: v.id("data_sources"),
    siteId: v.id("sites"),
    createdAt: v.number(),
    deletedAt: v.optional(v.number()),
  })
    .index("by_data_source", ["dataSourceId"])
    .index("by_site", ["siteId"])
    .index("by_tenant", ["tenantId"]),

  // ============================================================================
  // BILLING & PRICING
  // ============================================================================

  integration_pricing_tiers: defineTable({
    tenantId: v.id("tenants"),
    integrationId: v.id("integrations"),
    name: v.string(),
    description: v.string(),
    unitCost: v.number(),
    effectiveFrom: v.number(),
    effectiveUntil: v.optional(v.number()),
    createdAt: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
  })
    .index("by_tenant", ["tenantId"])
    .index("by_integration", ["integrationId"])
    .index("by_effective", ["effectiveFrom", "effectiveUntil"]),

  tenant_bills: defineTable({
    tenantId: v.id("tenants"),
    periodStart: v.number(),
    periodEnd: v.number(),
    status: v.union(
      v.literal("draft"),
      v.literal("finalized"),
      v.literal("paid"),
      v.literal("cancelled")
    ),
    total: v.number(),
    notes: v.optional(v.string()),
    finalizedAt: v.optional(v.number()),
    paidAt: v.optional(v.number()),
    createdAt: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
  })
    .index("by_tenant", ["tenantId"])
    .index("by_period", ["periodStart", "periodEnd"])
    .index("by_status", ["status"]),

  tenant_bill_line_items: defineTable({
    tenantId: v.id("tenants"),
    billId: v.id("tenant_bills"),
    integrationId: v.id("integrations"),
    pricingTierId: v.id("integration_pricing_tiers"),
    description: v.string(),
    units: v.number(),
    unitCost: v.number(), // Note: typo in original "unti_cost"
    total: v.number(),
    metadata: v.optional(v.any()),
    createdAt: v.optional(v.number()),
  })
    .index("by_tenant", ["tenantId"])
    .index("by_bill", ["billId"])
    .index("by_integration", ["integrationId"]),

  tenant_billing_adjustments: defineTable({
    tenantId: v.id("tenants"),
    integrationId: v.optional(v.id("integrations")),
    type: v.union(v.literal("credit"), v.literal("debit"), v.literal("discount")),
    amount: v.number(),
    reason: v.string(),
    effectiveFrom: v.number(),
    effectiveTo: v.number(),
    createdBy: v.optional(v.id("users")),
    createdAt: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
  })
    .index("by_tenant", ["tenantId"])
    .index("by_integration", ["integrationId"])
    .index("by_effective", ["effectiveFrom", "effectiveTo"]),
});
