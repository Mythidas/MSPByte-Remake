import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const entityTypeValidator = v.union(
    v.literal("companies"),
    v.literal("endpoints"),
    v.literal("identities"),
    v.literal("firewalls"),
    v.literal("groups"),
    v.literal("roles"),
    v.literal("policies"),
    v.literal("licenses")
);

export default defineSchema({
    // Core entities
    tenants: defineTable({
        name: v.string(),
        status: v.union(
            v.literal("active"),
            v.literal("inactive"),
            v.literal("suspended")
        ),

        metadata: v.optional(v.any()),

        updatedAt: v.number(),
        deletedAt: v.optional(v.number()),
    }).index("by_status", ["status"]),

    users: defineTable({
        // Uses Clerk user ID as the document ID (set via ctx.db.insert with specific ID)
        tenantId: v.id("tenants"),
        roleId: v.id("roles"),
        clerkId: v.string(),
        email: v.string(),
        name: v.string(),
        status: v.union(
            v.literal("active"),
            v.literal("inactive"),
            v.literal("pending")
        ),
        metadata: v.object({
            currentSite: v.optional(v.id("sites")),
        }),
        lastActivityAt: v.optional(v.number()),

        updatedAt: v.number(),
        deletedAt: v.optional(v.number()),
    })
        .index("by_tenant", ["tenantId"])
        .index("by_role", ["roleId", "tenantId"])
        .index("by_email", ["email", "tenantId"])
        .index("by_clerk", ["clerkId", "tenantId"]),

    roles: defineTable({
        tenantId: v.optional(v.id("tenants")), // null = global role
        name: v.string(),
        description: v.string(),
        rights: v.any(), // JSON object of permissions // TODO: Define structure for rights

        updatedAt: v.number(),
        deletedAt: v.optional(v.number()),
    }).index("by_tenant", ["tenantId"]),

    sites: defineTable({
        tenantId: v.id("tenants"),
        name: v.string(),
        slug: v.string(),
        status: v.union(
            v.literal("active"),
            v.literal("inactive"),
            v.literal("archived")
        ),
        psaIntegrationId: v.optional(v.id("integrations")),
        psaIntegrationName: v.optional(v.string()), // Denormalized for sorting/filtering
        psaCompanyId: v.optional(v.string()),
        psaParentCompanyId: v.optional(v.string()),
        metadata: v.optional(v.any()),

        updatedAt: v.number(),
        deletedAt: v.optional(v.number()),
    })
        .index("by_tenant", ["tenantId"])
        .index("by_status", ["status", "tenantId"])
        .index("by_slug", ["slug", "tenantId"])
        .index("by_psa_company", ["psaCompanyId", "tenantId"])
        .index("by_integration", ["psaIntegrationId", "tenantId"]),

    integrations: defineTable({
        // Uses slug as the document ID (like "halopsa", "sophos")
        name: v.string(),
        slug: v.string(),
        description: v.string(),
        category: v.string(), // e.g., "psa", "rmm", "security"
        supportedTypes: v.array(
            v.object({
                type: entityTypeValidator,
                isGlobal: v.boolean(),
            })
        ), // e.g., ["sites", "devices", "tickets"]
        iconUrl: v.optional(v.string()),
        color: v.optional(v.string()),
        level: v.optional(v.string()), // tier/level of integration
        productUrl: v.optional(v.string()),
        configSchema: v.optional(v.any()), // JSON schema for configuration
        isActive: v.optional(v.boolean()),

        updatedAt: v.number(),
    })
        .index("by_slug", ["slug"])
        .index("by_category", ["category"])
        .index("by_is_active", ["isActive"]),

    data_sources: defineTable({
        tenantId: v.id("tenants"),
        integrationId: v.id("integrations"),
        siteId: v.optional(v.id("sites")), // null = global/tenant-level data source
        externalId: v.optional(v.string()), // ID in the external system
        isPrimary: v.boolean(),
        status: v.union(
            v.literal("active"),
            v.literal("inactive"),
            v.literal("error")
        ),
        config: v.any(), // Data source configuration (credentials, settings, etc.)
        metadata: v.optional(v.any()), // Storing sync states and cursors
        credentialExpirationAt: v.number(), // When credentials expire
        lastSyncAt: v.optional(v.number()),

        updatedAt: v.number(),
        deletedAt: v.optional(v.number()),
    })
        .index("by_tenant", ["tenantId"])
        .index("by_integration", ["integrationId", "tenantId"])
        .index("by_primary", ["isPrimary", "tenantId"])
        .index("by_site", ["siteId", "tenantId"])
        .index("by_external_id", ["externalId", "tenantId"])
        .index("by_integration_primary", [
            "integrationId",
            "isPrimary",
            "tenantId",
        ]),

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
        status: v.optional(
            v.union(v.literal("online"), v.literal("offline"), v.literal("unknown"))
        ),
        statusChangedAt: v.optional(v.number()),
        registeredAt: v.optional(v.number()),

        updatedAt: v.number(),
        deletedAt: v.optional(v.number()),
    })
        .index("by_tenant", ["tenantId"])
        .index("by_site", ["siteId", "tenantId"])
        .index("by_status", ["status", "tenantId"])
        .index("by_platform", ["platform", "tenantId"])
        .index("by_guid", ["guid", "tenantId"])
        .index("by_version", ["version", "tenantId"]),

    scheduled_jobs: defineTable({
        tenantId: v.id("tenants"),
        integrationId: v.id("integrations"),
        integrationSlug: v.string(), // Slug for event routing (e.g., "autotask", "sophos-partner")
        dataSourceId: v.id("data_sources"),
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
        startedAt: v.optional(v.number()),
        error: v.optional(v.string()),
        createdBy: v.string(),

        updatedAt: v.number(),
    })
        .index("by_tenant", ["tenantId"])
        .index("by_integration", ["integrationId", "tenantId"])
        .index("by_pending_due", ["status", "scheduledAt", "tenantId"])
        .index("by_data_source", ["dataSourceId", "tenantId"])
        .index("by_data_source_status", ["dataSourceId", "status", "tenantId"])
        .index("by_status", ["status", "tenantId"])
        .index("by_scheduled_at", ["scheduledAt", "tenantId"]),

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

        updatedAt: v.optional(v.number()),
    })
        .index("by_tenant", ["tenantId"])
        .index("by_site", ["siteId"])
        .index("by_agent", ["agentId"]),

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
    }).index("by_expires_at", ["expiresAt"]),

    audit_log: defineTable({
        tenantId: v.id("tenants"),
        userId: v.optional(v.id("users")),
        tableName: v.string(),
        recordId: v.string(),
        action: v.union(
            v.literal("create"),
            v.literal("update"),
            v.literal("delete")
        ),
        changes: v.any(), // JSON diff of changes
    })
        .index("by_tenant", ["tenantId"])
        .index("by_user", ["userId"])
        .index("by_table", ["tableName"]),

    health_checks: defineTable({
        tenantId: v.id("tenants"),
        resourceType: v.string(), // "integration", "data_source", etc.
        resourceId: v.string(),
        status: v.union(
            v.literal("healthy"),
            v.literal("degraded"),
            v.literal("down")
        ),
        failureCount: v.number(),
        lastCheckAt: v.number(),
        lastSuccessAt: v.optional(v.number()),
        lastFailureAt: v.optional(v.number()),
        errorMessage: v.optional(v.string()),
        metadata: v.optional(v.any()),

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
        entityType: entityTypeValidator, // "device", "ticket", "company", etc.
        externalId: v.string(), // ID in the external system
        dataHash: v.string(), // Hash for change detection
        rawData: v.any(), // Original data from integration
        normalizedData: v.any(), // Normalized/mapped data

        updatedAt: v.number(),
    })
        .index("by_tenant", ["tenantId"])
        .index("by_integration", ["integrationId", "tenantId"])
        .index("by_type", ["entityType", "tenantId"])
        .index("by_data_source", ["dataSourceId", "tenantId"])
        .index("by_site", ["siteId", "tenantId"])
        .index("by_site_type", ["siteId", "entityType", "tenantId"])
        .index("by_data_source_type", ["dataSourceId", "entityType", "tenantId"])
        .index("by_external_id", ["externalId", "tenantId"])
        .index("by_integration_type", ["integrationId", "entityType", "tenantId"]),

    global_entities: defineTable({
        integrationId: v.id("integrations"),
        entityType: v.string(),
        externalId: v.string(),
        dataHash: v.string(),
        rawData: v.any(),
        normalizedData: v.any(),

        updatedAt: v.number(),
    })
        .index("by_integration", ["integrationId"])
        .index("by_type", ["entityType"])
        .index("by_external_id", ["integrationId", "externalId"]),

    entity_relationships: defineTable({
        tenantId: v.id("tenants"),
        dataSourceId: v.id("data_sources"),
        parentEntityId: v.id("entities"),
        childEntityId: v.id("entities"),
        relationshipType: v.string(), // "parent", "child", "related", etc.
        metadata: v.optional(v.any()),

        updatedAt: v.number(),
    })
        .index("by_tenant", ["tenantId"])
        .index("by_parent", ["parentEntityId", "tenantId"])
        .index("by_child", ["childEntityId", "tenantId"])
        .index("by_data_source_type", ["dataSourceId", "relationshipType", "tenantId"])
        .index("by_type", ["relationshipType", "tenantId"]),

    entity_alerts: defineTable({
        tenantId: v.id("tenants"),
        entityId: v.id("entities"),
        dataSourceId: v.id("data_sources"),
        siteId: v.optional(v.id("sites")),

        alertType: v.string(), // e.g., "mfa_not_enforced", "stale_user", "license_waste", "policy_gap"
        severity: v.union(
            v.literal("low"),
            v.literal("medium"),
            v.literal("high"),
            v.literal("critical")
        ),
        message: v.string(), // Human-readable alert description
        metadata: v.optional(v.any()), // Additional context (days inactive, license cost, etc.)
        status: v.union(
            v.literal("active"),
            v.literal("resolved"),
            v.literal("suppressed")
        ),

        resolvedAt: v.optional(v.number()),
        suppressedBy: v.optional(v.id("users")),
        suppressedAt: v.optional(v.number()),
        suppressionReason: v.optional(v.string()),
        suppressedUntil: v.optional(v.number()),
        updatedAt: v.number(),
    })
        .index("by_tenant", ["tenantId"])
        .index("by_site", ["siteId", "tenantId"])
        .index("by_data_source", ["dataSourceId", "tenantId"])
        .index("by_entity", ["entityId", "tenantId"])
        .index("by_type", ["alertType", "tenantId"])
        .index("by_severity", ["severity", "tenantId"])
        .index("by_status", ["status", "tenantId"])
        .index("by_entity_status", ["entityId", "status", "tenantId"]),

    // ============================================================================
    // RELATIONSHIPS & MAPPING
    // ============================================================================

    data_source_to_site: defineTable({
        tenantId: v.id("tenants"),
        integrationId: v.id("integrations"),
        dataSourceId: v.id("data_sources"),
        siteId: v.id("sites"),

        deletedAt: v.optional(v.number()),
    })
        .index("by_tenant", ["tenantId"])
        .index("by_integration", ["integrationId", "tenantId"])
        .index("by_data_source", ["dataSourceId", "tenantId"])
        .index("by_site", ["siteId", "tenantId"]),
});
