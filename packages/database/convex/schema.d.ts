export declare const entityTypeValidator: import("convex/values").VUnion<"companies" | "endpoints" | "identities" | "firewalls" | "groups" | "roles" | "policies" | "licenses", [import("convex/values").VLiteral<"companies", "required">, import("convex/values").VLiteral<"endpoints", "required">, import("convex/values").VLiteral<"identities", "required">, import("convex/values").VLiteral<"firewalls", "required">, import("convex/values").VLiteral<"groups", "required">, import("convex/values").VLiteral<"roles", "required">, import("convex/values").VLiteral<"policies", "required">, import("convex/values").VLiteral<"licenses", "required">], "required", never>;
declare const _default: import("convex/server").SchemaDefinition<{
    tenants: import("convex/server").TableDefinition<import("convex/values").VObject<{
        metadata?: any;
        concurrentJobLimit?: number | undefined;
        deletedAt?: number | undefined;
        status: "active" | "inactive" | "suspended";
        name: string;
        updatedAt: number;
    }, {
        name: import("convex/values").VString<string, "required">;
        status: import("convex/values").VUnion<"active" | "inactive" | "suspended", [import("convex/values").VLiteral<"active", "required">, import("convex/values").VLiteral<"inactive", "required">, import("convex/values").VLiteral<"suspended", "required">], "required", never>;
        metadata: import("convex/values").VAny<any, "optional", string>;
        concurrentJobLimit: import("convex/values").VFloat64<number | undefined, "optional">;
        updatedAt: import("convex/values").VFloat64<number, "required">;
        deletedAt: import("convex/values").VFloat64<number | undefined, "optional">;
    }, "required", "status" | "name" | "metadata" | "concurrentJobLimit" | "updatedAt" | "deletedAt" | `metadata.${string}`>, {
        by_status: ["status", "_creationTime"];
    }, {}, {}>;
    users: import("convex/server").TableDefinition<import("convex/values").VObject<{
        deletedAt?: number | undefined;
        lastActivityAt?: number | undefined;
        status: "active" | "inactive" | "pending";
        email: string;
        name: string;
        metadata: {
            currentSite?: import("convex/values").GenericId<"sites"> | undefined;
            currentMode?: string | undefined;
        };
        updatedAt: number;
        tenantId: import("convex/values").GenericId<"tenants">;
        roleId: import("convex/values").GenericId<"roles">;
        clerkId: string;
    }, {
        tenantId: import("convex/values").VId<import("convex/values").GenericId<"tenants">, "required">;
        roleId: import("convex/values").VId<import("convex/values").GenericId<"roles">, "required">;
        clerkId: import("convex/values").VString<string, "required">;
        email: import("convex/values").VString<string, "required">;
        name: import("convex/values").VString<string, "required">;
        status: import("convex/values").VUnion<"active" | "inactive" | "pending", [import("convex/values").VLiteral<"active", "required">, import("convex/values").VLiteral<"inactive", "required">, import("convex/values").VLiteral<"pending", "required">], "required", never>;
        metadata: import("convex/values").VObject<{
            currentSite?: import("convex/values").GenericId<"sites"> | undefined;
            currentMode?: string | undefined;
        }, {
            currentSite: import("convex/values").VId<import("convex/values").GenericId<"sites"> | undefined, "optional">;
            currentMode: import("convex/values").VString<string | undefined, "optional">;
        }, "required", "currentSite" | "currentMode">;
        lastActivityAt: import("convex/values").VFloat64<number | undefined, "optional">;
        updatedAt: import("convex/values").VFloat64<number, "required">;
        deletedAt: import("convex/values").VFloat64<number | undefined, "optional">;
    }, "required", "status" | "email" | "name" | "metadata" | "updatedAt" | "deletedAt" | "tenantId" | "roleId" | "clerkId" | "lastActivityAt" | "metadata.currentSite" | "metadata.currentMode">, {
        by_tenant: ["tenantId", "_creationTime"];
        by_role: ["roleId", "tenantId", "_creationTime"];
        by_email: ["email", "tenantId", "_creationTime"];
        by_clerk: ["clerkId", "tenantId", "_creationTime"];
    }, {}, {}>;
    roles: import("convex/server").TableDefinition<import("convex/values").VObject<{
        deletedAt?: number | undefined;
        tenantId?: import("convex/values").GenericId<"tenants"> | undefined;
        name: string;
        updatedAt: number;
        description: string;
        rights: any;
    }, {
        tenantId: import("convex/values").VId<import("convex/values").GenericId<"tenants"> | undefined, "optional">;
        name: import("convex/values").VString<string, "required">;
        description: import("convex/values").VString<string, "required">;
        rights: import("convex/values").VAny<any, "required", string>;
        updatedAt: import("convex/values").VFloat64<number, "required">;
        deletedAt: import("convex/values").VFloat64<number | undefined, "optional">;
    }, "required", "name" | "updatedAt" | "deletedAt" | "tenantId" | "description" | "rights" | `rights.${string}`>, {
        by_tenant: ["tenantId", "_creationTime"];
    }, {}, {}>;
    sites: import("convex/server").TableDefinition<import("convex/values").VObject<{
        metadata?: any;
        deletedAt?: number | undefined;
        psaIntegrationId?: import("convex/values").GenericId<"integrations"> | undefined;
        psaIntegrationName?: string | undefined;
        psaCompanyId?: string | undefined;
        psaParentCompanyId?: string | undefined;
        status: "active" | "inactive" | "archived";
        name: string;
        updatedAt: number;
        tenantId: import("convex/values").GenericId<"tenants">;
        slug: string;
    }, {
        tenantId: import("convex/values").VId<import("convex/values").GenericId<"tenants">, "required">;
        name: import("convex/values").VString<string, "required">;
        slug: import("convex/values").VString<string, "required">;
        status: import("convex/values").VUnion<"active" | "inactive" | "archived", [import("convex/values").VLiteral<"active", "required">, import("convex/values").VLiteral<"inactive", "required">, import("convex/values").VLiteral<"archived", "required">], "required", never>;
        psaIntegrationId: import("convex/values").VId<import("convex/values").GenericId<"integrations"> | undefined, "optional">;
        psaIntegrationName: import("convex/values").VString<string | undefined, "optional">;
        psaCompanyId: import("convex/values").VString<string | undefined, "optional">;
        psaParentCompanyId: import("convex/values").VString<string | undefined, "optional">;
        metadata: import("convex/values").VAny<any, "optional", string>;
        updatedAt: import("convex/values").VFloat64<number, "required">;
        deletedAt: import("convex/values").VFloat64<number | undefined, "optional">;
    }, "required", "status" | "name" | "metadata" | "updatedAt" | "deletedAt" | `metadata.${string}` | "tenantId" | "slug" | "psaIntegrationId" | "psaIntegrationName" | "psaCompanyId" | "psaParentCompanyId">, {
        by_tenant: ["tenantId", "_creationTime"];
        by_status: ["status", "tenantId", "_creationTime"];
        by_slug: ["slug", "tenantId", "_creationTime"];
        by_psa_company: ["psaCompanyId", "tenantId", "_creationTime"];
        by_integration: ["psaIntegrationId", "tenantId", "_creationTime"];
    }, {}, {}>;
    integrations: import("convex/server").TableDefinition<import("convex/values").VObject<{
        iconUrl?: string | undefined;
        color?: string | undefined;
        level?: string | undefined;
        productUrl?: string | undefined;
        configSchema?: any;
        isActive?: boolean | undefined;
        name: string;
        updatedAt: number;
        description: string;
        slug: string;
        category: string;
        supportedTypes: {
            priority?: number | undefined;
            rateMinutes?: number | undefined;
            type: "companies" | "endpoints" | "identities" | "firewalls" | "groups" | "roles" | "policies" | "licenses";
            isGlobal: boolean;
        }[];
    }, {
        name: import("convex/values").VString<string, "required">;
        slug: import("convex/values").VString<string, "required">;
        description: import("convex/values").VString<string, "required">;
        category: import("convex/values").VString<string, "required">;
        supportedTypes: import("convex/values").VArray<{
            priority?: number | undefined;
            rateMinutes?: number | undefined;
            type: "companies" | "endpoints" | "identities" | "firewalls" | "groups" | "roles" | "policies" | "licenses";
            isGlobal: boolean;
        }[], import("convex/values").VObject<{
            priority?: number | undefined;
            rateMinutes?: number | undefined;
            type: "companies" | "endpoints" | "identities" | "firewalls" | "groups" | "roles" | "policies" | "licenses";
            isGlobal: boolean;
        }, {
            type: import("convex/values").VUnion<"companies" | "endpoints" | "identities" | "firewalls" | "groups" | "roles" | "policies" | "licenses", [import("convex/values").VLiteral<"companies", "required">, import("convex/values").VLiteral<"endpoints", "required">, import("convex/values").VLiteral<"identities", "required">, import("convex/values").VLiteral<"firewalls", "required">, import("convex/values").VLiteral<"groups", "required">, import("convex/values").VLiteral<"roles", "required">, import("convex/values").VLiteral<"policies", "required">, import("convex/values").VLiteral<"licenses", "required">], "required", never>;
            isGlobal: import("convex/values").VBoolean<boolean, "required">;
            priority: import("convex/values").VFloat64<number | undefined, "optional">;
            rateMinutes: import("convex/values").VFloat64<number | undefined, "optional">;
        }, "required", "type" | "isGlobal" | "priority" | "rateMinutes">, "required">;
        iconUrl: import("convex/values").VString<string | undefined, "optional">;
        color: import("convex/values").VString<string | undefined, "optional">;
        level: import("convex/values").VString<string | undefined, "optional">;
        productUrl: import("convex/values").VString<string | undefined, "optional">;
        configSchema: import("convex/values").VAny<any, "optional", string>;
        isActive: import("convex/values").VBoolean<boolean | undefined, "optional">;
        updatedAt: import("convex/values").VFloat64<number, "required">;
    }, "required", "name" | "updatedAt" | "description" | "slug" | "category" | "supportedTypes" | "iconUrl" | "color" | "level" | "productUrl" | "configSchema" | "isActive" | `configSchema.${string}`>, {
        by_slug: ["slug", "_creationTime"];
        by_category: ["category", "_creationTime"];
        by_is_active: ["isActive", "_creationTime"];
    }, {}, {}>;
    data_sources: import("convex/server").TableDefinition<import("convex/values").VObject<{
        externalId?: string | undefined;
        metadata?: any;
        deletedAt?: number | undefined;
        siteId?: import("convex/values").GenericId<"sites"> | undefined;
        lastSyncAt?: number | undefined;
        syncStatus?: "error" | "idle" | "syncing_batch" | "syncing_final" | undefined;
        currentSyncId?: string | undefined;
        status: "error" | "active" | "inactive";
        updatedAt: number;
        tenantId: import("convex/values").GenericId<"tenants">;
        integrationId: import("convex/values").GenericId<"integrations">;
        isPrimary: boolean;
        config: any;
        credentialExpirationAt: number;
    }, {
        tenantId: import("convex/values").VId<import("convex/values").GenericId<"tenants">, "required">;
        integrationId: import("convex/values").VId<import("convex/values").GenericId<"integrations">, "required">;
        siteId: import("convex/values").VId<import("convex/values").GenericId<"sites"> | undefined, "optional">;
        externalId: import("convex/values").VString<string | undefined, "optional">;
        isPrimary: import("convex/values").VBoolean<boolean, "required">;
        status: import("convex/values").VUnion<"error" | "active" | "inactive", [import("convex/values").VLiteral<"active", "required">, import("convex/values").VLiteral<"inactive", "required">, import("convex/values").VLiteral<"error", "required">], "required", never>;
        config: import("convex/values").VAny<any, "required", string>;
        metadata: import("convex/values").VAny<any, "optional", string>;
        credentialExpirationAt: import("convex/values").VFloat64<number, "required">;
        lastSyncAt: import("convex/values").VFloat64<number | undefined, "optional">;
        syncStatus: import("convex/values").VUnion<"error" | "idle" | "syncing_batch" | "syncing_final" | undefined, [import("convex/values").VLiteral<"idle", "required">, import("convex/values").VLiteral<"syncing_batch", "required">, import("convex/values").VLiteral<"syncing_final", "required">, import("convex/values").VLiteral<"error", "required">], "optional", never>;
        currentSyncId: import("convex/values").VString<string | undefined, "optional">;
        updatedAt: import("convex/values").VFloat64<number, "required">;
        deletedAt: import("convex/values").VFloat64<number | undefined, "optional">;
    }, "required", "status" | "externalId" | "metadata" | "updatedAt" | "deletedAt" | `metadata.${string}` | "tenantId" | "integrationId" | "siteId" | "isPrimary" | "config" | "credentialExpirationAt" | "lastSyncAt" | "syncStatus" | "currentSyncId" | `config.${string}`>, {
        by_tenant: ["tenantId", "_creationTime"];
        by_integration: ["integrationId", "tenantId", "_creationTime"];
        by_primary: ["isPrimary", "tenantId", "_creationTime"];
        by_site: ["siteId", "tenantId", "_creationTime"];
        by_external_id: ["externalId", "tenantId", "_creationTime"];
        by_integration_primary: ["integrationId", "isPrimary", "tenantId", "_creationTime"];
    }, {}, {}>;
    agents: import("convex/server").TableDefinition<import("convex/values").VObject<{
        status?: "online" | "offline" | "unknown" | undefined;
        deletedAt?: number | undefined;
        ipAddress?: string | undefined;
        macAddress?: string | undefined;
        extAddress?: string | undefined;
        statusChangedAt?: number | undefined;
        registeredAt?: number | undefined;
        updatedAt: number;
        tenantId: import("convex/values").GenericId<"tenants">;
        siteId: import("convex/values").GenericId<"sites">;
        guid: string;
        hostname: string;
        platform: string;
        version: string;
    }, {
        tenantId: import("convex/values").VId<import("convex/values").GenericId<"tenants">, "required">;
        siteId: import("convex/values").VId<import("convex/values").GenericId<"sites">, "required">;
        guid: import("convex/values").VString<string, "required">;
        hostname: import("convex/values").VString<string, "required">;
        platform: import("convex/values").VString<string, "required">;
        version: import("convex/values").VString<string, "required">;
        ipAddress: import("convex/values").VString<string | undefined, "optional">;
        macAddress: import("convex/values").VString<string | undefined, "optional">;
        extAddress: import("convex/values").VString<string | undefined, "optional">;
        status: import("convex/values").VUnion<"online" | "offline" | "unknown" | undefined, [import("convex/values").VLiteral<"online", "required">, import("convex/values").VLiteral<"offline", "required">, import("convex/values").VLiteral<"unknown", "required">], "optional", never>;
        statusChangedAt: import("convex/values").VFloat64<number | undefined, "optional">;
        registeredAt: import("convex/values").VFloat64<number | undefined, "optional">;
        updatedAt: import("convex/values").VFloat64<number, "required">;
        deletedAt: import("convex/values").VFloat64<number | undefined, "optional">;
    }, "required", "status" | "updatedAt" | "deletedAt" | "tenantId" | "siteId" | "guid" | "hostname" | "platform" | "version" | "ipAddress" | "macAddress" | "extAddress" | "statusChangedAt" | "registeredAt">, {
        by_tenant: ["tenantId", "_creationTime"];
        by_site: ["siteId", "tenantId", "_creationTime"];
        by_status: ["status", "tenantId", "_creationTime"];
        by_platform: ["platform", "tenantId", "_creationTime"];
        by_guid: ["guid", "tenantId", "_creationTime"];
        by_version: ["version", "tenantId", "_creationTime"];
    }, {}, {}>;
    scheduled_jobs: import("convex/server").TableDefinition<import("convex/values").VObject<{
        error?: string | undefined;
        priority?: number | undefined;
        attempts?: number | undefined;
        attemptsMax?: number | undefined;
        nextRetryAt?: number | undefined;
        startedAt?: number | undefined;
        status: "pending" | "running" | "completed" | "failed" | "broken";
        updatedAt: number;
        tenantId: import("convex/values").GenericId<"tenants">;
        integrationId: import("convex/values").GenericId<"integrations">;
        integrationSlug: string;
        dataSourceId: import("convex/values").GenericId<"data_sources">;
        action: string;
        payload: any;
        scheduledAt: number;
        createdBy: string;
    }, {
        tenantId: import("convex/values").VId<import("convex/values").GenericId<"tenants">, "required">;
        integrationId: import("convex/values").VId<import("convex/values").GenericId<"integrations">, "required">;
        integrationSlug: import("convex/values").VString<string, "required">;
        dataSourceId: import("convex/values").VId<import("convex/values").GenericId<"data_sources">, "required">;
        action: import("convex/values").VString<string, "required">;
        payload: import("convex/values").VAny<any, "required", string>;
        priority: import("convex/values").VFloat64<number | undefined, "optional">;
        status: import("convex/values").VUnion<"pending" | "running" | "completed" | "failed" | "broken", [import("convex/values").VLiteral<"pending", "required">, import("convex/values").VLiteral<"running", "required">, import("convex/values").VLiteral<"completed", "required">, import("convex/values").VLiteral<"failed", "required">, import("convex/values").VLiteral<"broken", "required">], "required", never>;
        attempts: import("convex/values").VFloat64<number | undefined, "optional">;
        attemptsMax: import("convex/values").VFloat64<number | undefined, "optional">;
        nextRetryAt: import("convex/values").VFloat64<number | undefined, "optional">;
        scheduledAt: import("convex/values").VFloat64<number, "required">;
        startedAt: import("convex/values").VFloat64<number | undefined, "optional">;
        error: import("convex/values").VString<string | undefined, "optional">;
        createdBy: import("convex/values").VString<string, "required">;
        updatedAt: import("convex/values").VFloat64<number, "required">;
    }, "required", "status" | "error" | "updatedAt" | "tenantId" | "priority" | "integrationId" | "integrationSlug" | "dataSourceId" | "action" | "payload" | "attempts" | "attemptsMax" | "nextRetryAt" | "scheduledAt" | "startedAt" | "createdBy" | `payload.${string}`>, {
        by_tenant: ["tenantId", "_creationTime"];
        by_integration: ["integrationId", "tenantId", "_creationTime"];
        by_pending_due: ["status", "scheduledAt", "tenantId", "_creationTime"];
        by_data_source: ["dataSourceId", "tenantId", "_creationTime"];
        by_data_source_status: ["dataSourceId", "status", "tenantId", "_creationTime"];
        by_status: ["status", "tenantId", "_creationTime"];
        by_scheduled_at: ["scheduledAt", "tenantId", "_creationTime"];
        by_priority_and_scheduled_at: ["status", "priority", "scheduledAt", "_creationTime"];
    }, {}, {}>;
    agent_api_logs: import("convex/server").TableDefinition<import("convex/values").VObject<{
        externalId?: string | undefined;
        updatedAt?: number | undefined;
        psaSiteId?: string | undefined;
        rmmDeviceId?: string | undefined;
        timeElapsedMs?: number | undefined;
        errorMessage?: string | undefined;
        tenantId: import("convex/values").GenericId<"tenants">;
        siteId: import("convex/values").GenericId<"sites">;
        agentId: import("convex/values").GenericId<"agents">;
        endpoint: string;
        method: string;
        statusCode: number;
        reqMetadata: any;
        resMetadata: any;
    }, {
        tenantId: import("convex/values").VId<import("convex/values").GenericId<"tenants">, "required">;
        siteId: import("convex/values").VId<import("convex/values").GenericId<"sites">, "required">;
        agentId: import("convex/values").VId<import("convex/values").GenericId<"agents">, "required">;
        endpoint: import("convex/values").VString<string, "required">;
        method: import("convex/values").VString<string, "required">;
        statusCode: import("convex/values").VFloat64<number, "required">;
        externalId: import("convex/values").VString<string | undefined, "optional">;
        psaSiteId: import("convex/values").VString<string | undefined, "optional">;
        rmmDeviceId: import("convex/values").VString<string | undefined, "optional">;
        reqMetadata: import("convex/values").VAny<any, "required", string>;
        resMetadata: import("convex/values").VAny<any, "required", string>;
        timeElapsedMs: import("convex/values").VFloat64<number | undefined, "optional">;
        errorMessage: import("convex/values").VString<string | undefined, "optional">;
        updatedAt: import("convex/values").VFloat64<number | undefined, "optional">;
    }, "required", "externalId" | "updatedAt" | "tenantId" | "siteId" | "agentId" | "endpoint" | "method" | "statusCode" | "psaSiteId" | "rmmDeviceId" | "reqMetadata" | "resMetadata" | "timeElapsedMs" | "errorMessage" | `reqMetadata.${string}` | `resMetadata.${string}`>, {
        by_tenant: ["tenantId", "_creationTime"];
        by_site: ["siteId", "_creationTime"];
        by_agent: ["agentId", "_creationTime"];
    }, {}, {}>;
    api_logs: import("convex/server").TableDefinition<import("convex/values").VObject<{
        statusCode?: number | undefined;
        durationMs?: number | undefined;
        body?: string | undefined;
        responseBody?: string | undefined;
        headers?: any;
        responseHeaders?: any;
        errorCode?: string | undefined;
        method: string;
        url: string;
        expiresAt: number;
    }, {
        url: import("convex/values").VString<string, "required">;
        method: import("convex/values").VString<string, "required">;
        statusCode: import("convex/values").VFloat64<number | undefined, "optional">;
        durationMs: import("convex/values").VFloat64<number | undefined, "optional">;
        body: import("convex/values").VString<string | undefined, "optional">;
        responseBody: import("convex/values").VString<string | undefined, "optional">;
        headers: import("convex/values").VAny<any, "optional", string>;
        responseHeaders: import("convex/values").VAny<any, "optional", string>;
        errorCode: import("convex/values").VString<string | undefined, "optional">;
        expiresAt: import("convex/values").VFloat64<number, "required">;
    }, "required", "method" | "statusCode" | "url" | "durationMs" | "body" | "responseBody" | "headers" | "responseHeaders" | "errorCode" | "expiresAt" | `headers.${string}` | `responseHeaders.${string}`>, {
        by_expires_at: ["expiresAt", "_creationTime"];
    }, {}, {}>;
    audit_log: import("convex/server").TableDefinition<import("convex/values").VObject<{
        userId?: import("convex/values").GenericId<"users"> | undefined;
        tableName: string;
        tenantId: import("convex/values").GenericId<"tenants">;
        action: "create" | "update" | "delete";
        recordId: string;
        changes: any;
    }, {
        tenantId: import("convex/values").VId<import("convex/values").GenericId<"tenants">, "required">;
        userId: import("convex/values").VId<import("convex/values").GenericId<"users"> | undefined, "optional">;
        tableName: import("convex/values").VString<string, "required">;
        recordId: import("convex/values").VString<string, "required">;
        action: import("convex/values").VUnion<"create" | "update" | "delete", [import("convex/values").VLiteral<"create", "required">, import("convex/values").VLiteral<"update", "required">, import("convex/values").VLiteral<"delete", "required">], "required", never>;
        changes: import("convex/values").VAny<any, "required", string>;
    }, "required", "tableName" | "tenantId" | "action" | "userId" | "recordId" | "changes" | `changes.${string}`>, {
        by_tenant: ["tenantId", "_creationTime"];
        by_user: ["userId", "_creationTime"];
        by_table: ["tableName", "_creationTime"];
    }, {}, {}>;
    health_checks: import("convex/server").TableDefinition<import("convex/values").VObject<{
        metadata?: any;
        errorMessage?: string | undefined;
        lastSuccessAt?: number | undefined;
        lastFailureAt?: number | undefined;
        status: "healthy" | "degraded" | "down";
        updatedAt: number;
        tenantId: import("convex/values").GenericId<"tenants">;
        resourceType: string;
        resourceId: string;
        failureCount: number;
        lastCheckAt: number;
    }, {
        tenantId: import("convex/values").VId<import("convex/values").GenericId<"tenants">, "required">;
        resourceType: import("convex/values").VString<string, "required">;
        resourceId: import("convex/values").VString<string, "required">;
        status: import("convex/values").VUnion<"healthy" | "degraded" | "down", [import("convex/values").VLiteral<"healthy", "required">, import("convex/values").VLiteral<"degraded", "required">, import("convex/values").VLiteral<"down", "required">], "required", never>;
        failureCount: import("convex/values").VFloat64<number, "required">;
        lastCheckAt: import("convex/values").VFloat64<number, "required">;
        lastSuccessAt: import("convex/values").VFloat64<number | undefined, "optional">;
        lastFailureAt: import("convex/values").VFloat64<number | undefined, "optional">;
        errorMessage: import("convex/values").VString<string | undefined, "optional">;
        metadata: import("convex/values").VAny<any, "optional", string>;
        updatedAt: import("convex/values").VFloat64<number, "required">;
    }, "required", "status" | "metadata" | "updatedAt" | `metadata.${string}` | "tenantId" | "errorMessage" | "resourceType" | "resourceId" | "failureCount" | "lastCheckAt" | "lastSuccessAt" | "lastFailureAt">, {
        by_tenant: ["tenantId", "_creationTime"];
        by_resource: ["resourceType", "resourceId", "_creationTime"];
        by_status: ["status", "_creationTime"];
    }, {}, {}>;
    entities: import("convex/server").TableDefinition<import("convex/values").VObject<{
        deletedAt?: number | undefined;
        siteId?: import("convex/values").GenericId<"sites"> | undefined;
        lastSeenAt?: number | undefined;
        syncId?: string | undefined;
        externalId: string;
        updatedAt: number;
        tenantId: import("convex/values").GenericId<"tenants">;
        integrationId: import("convex/values").GenericId<"integrations">;
        dataSourceId: import("convex/values").GenericId<"data_sources">;
        entityType: "companies" | "endpoints" | "identities" | "firewalls" | "groups" | "roles" | "policies" | "licenses";
        dataHash: string;
        rawData: any;
        normalizedData: any;
    }, {
        tenantId: import("convex/values").VId<import("convex/values").GenericId<"tenants">, "required">;
        integrationId: import("convex/values").VId<import("convex/values").GenericId<"integrations">, "required">;
        dataSourceId: import("convex/values").VId<import("convex/values").GenericId<"data_sources">, "required">;
        siteId: import("convex/values").VId<import("convex/values").GenericId<"sites"> | undefined, "optional">;
        entityType: import("convex/values").VUnion<"companies" | "endpoints" | "identities" | "firewalls" | "groups" | "roles" | "policies" | "licenses", [import("convex/values").VLiteral<"companies", "required">, import("convex/values").VLiteral<"endpoints", "required">, import("convex/values").VLiteral<"identities", "required">, import("convex/values").VLiteral<"firewalls", "required">, import("convex/values").VLiteral<"groups", "required">, import("convex/values").VLiteral<"roles", "required">, import("convex/values").VLiteral<"policies", "required">, import("convex/values").VLiteral<"licenses", "required">], "required", never>;
        externalId: import("convex/values").VString<string, "required">;
        dataHash: import("convex/values").VString<string, "required">;
        rawData: import("convex/values").VAny<any, "required", string>;
        normalizedData: import("convex/values").VAny<any, "required", string>;
        deletedAt: import("convex/values").VFloat64<number | undefined, "optional">;
        lastSeenAt: import("convex/values").VFloat64<number | undefined, "optional">;
        syncId: import("convex/values").VString<string | undefined, "optional">;
        updatedAt: import("convex/values").VFloat64<number, "required">;
    }, "required", "externalId" | "updatedAt" | "deletedAt" | "tenantId" | "integrationId" | "siteId" | "dataSourceId" | "entityType" | "dataHash" | "rawData" | "normalizedData" | "lastSeenAt" | "syncId" | `rawData.${string}` | `normalizedData.${string}`>, {
        by_tenant: ["tenantId", "_creationTime"];
        by_integration: ["integrationId", "tenantId", "_creationTime"];
        by_type: ["entityType", "tenantId", "_creationTime"];
        by_data_source: ["dataSourceId", "tenantId", "_creationTime"];
        by_site: ["siteId", "tenantId", "_creationTime"];
        by_site_type: ["siteId", "entityType", "tenantId", "_creationTime"];
        by_data_source_type: ["dataSourceId", "entityType", "tenantId", "_creationTime"];
        by_external_id: ["externalId", "tenantId", "_creationTime"];
        by_integration_type: ["integrationId", "entityType", "tenantId", "_creationTime"];
        by_sync_id: ["syncId", "dataSourceId", "_creationTime"];
        by_deleted_at: ["deletedAt", "_creationTime"];
    }, {}, {}>;
    global_entities: import("convex/server").TableDefinition<import("convex/values").VObject<{
        externalId: string;
        updatedAt: number;
        integrationId: import("convex/values").GenericId<"integrations">;
        entityType: string;
        dataHash: string;
        rawData: any;
        normalizedData: any;
    }, {
        integrationId: import("convex/values").VId<import("convex/values").GenericId<"integrations">, "required">;
        entityType: import("convex/values").VString<string, "required">;
        externalId: import("convex/values").VString<string, "required">;
        dataHash: import("convex/values").VString<string, "required">;
        rawData: import("convex/values").VAny<any, "required", string>;
        normalizedData: import("convex/values").VAny<any, "required", string>;
        updatedAt: import("convex/values").VFloat64<number, "required">;
    }, "required", "externalId" | "updatedAt" | "integrationId" | "entityType" | "dataHash" | "rawData" | "normalizedData" | `rawData.${string}` | `normalizedData.${string}`>, {
        by_integration: ["integrationId", "_creationTime"];
        by_type: ["entityType", "_creationTime"];
        by_external_id: ["integrationId", "externalId", "_creationTime"];
    }, {}, {}>;
    entity_relationships: import("convex/server").TableDefinition<import("convex/values").VObject<{
        metadata?: any;
        updatedAt: number;
        tenantId: import("convex/values").GenericId<"tenants">;
        dataSourceId: import("convex/values").GenericId<"data_sources">;
        parentEntityId: import("convex/values").GenericId<"entities">;
        childEntityId: import("convex/values").GenericId<"entities">;
        relationshipType: string;
    }, {
        tenantId: import("convex/values").VId<import("convex/values").GenericId<"tenants">, "required">;
        dataSourceId: import("convex/values").VId<import("convex/values").GenericId<"data_sources">, "required">;
        parentEntityId: import("convex/values").VId<import("convex/values").GenericId<"entities">, "required">;
        childEntityId: import("convex/values").VId<import("convex/values").GenericId<"entities">, "required">;
        relationshipType: import("convex/values").VString<string, "required">;
        metadata: import("convex/values").VAny<any, "optional", string>;
        updatedAt: import("convex/values").VFloat64<number, "required">;
    }, "required", "metadata" | "updatedAt" | `metadata.${string}` | "tenantId" | "dataSourceId" | "parentEntityId" | "childEntityId" | "relationshipType">, {
        by_tenant: ["tenantId", "_creationTime"];
        by_parent: ["parentEntityId", "tenantId", "_creationTime"];
        by_child: ["childEntityId", "tenantId", "_creationTime"];
        by_data_source_type: ["dataSourceId", "relationshipType", "tenantId", "_creationTime"];
        by_type: ["relationshipType", "tenantId", "_creationTime"];
    }, {}, {}>;
    entity_alerts: import("convex/server").TableDefinition<import("convex/values").VObject<{
        metadata?: any;
        siteId?: import("convex/values").GenericId<"sites"> | undefined;
        resolvedAt?: number | undefined;
        suppressedBy?: import("convex/values").GenericId<"users"> | undefined;
        suppressedAt?: number | undefined;
        suppressionReason?: string | undefined;
        suppressedUntil?: number | undefined;
        message: string;
        status: "active" | "resolved" | "suppressed";
        updatedAt: number;
        tenantId: import("convex/values").GenericId<"tenants">;
        integrationId: import("convex/values").GenericId<"integrations">;
        integrationSlug: string;
        dataSourceId: import("convex/values").GenericId<"data_sources">;
        entityId: import("convex/values").GenericId<"entities">;
        alertType: string;
        severity: "low" | "critical" | "medium" | "high";
    }, {
        tenantId: import("convex/values").VId<import("convex/values").GenericId<"tenants">, "required">;
        entityId: import("convex/values").VId<import("convex/values").GenericId<"entities">, "required">;
        dataSourceId: import("convex/values").VId<import("convex/values").GenericId<"data_sources">, "required">;
        integrationId: import("convex/values").VId<import("convex/values").GenericId<"integrations">, "required">;
        integrationSlug: import("convex/values").VString<string, "required">;
        siteId: import("convex/values").VId<import("convex/values").GenericId<"sites"> | undefined, "optional">;
        alertType: import("convex/values").VString<string, "required">;
        severity: import("convex/values").VUnion<"low" | "critical" | "medium" | "high", [import("convex/values").VLiteral<"low", "required">, import("convex/values").VLiteral<"medium", "required">, import("convex/values").VLiteral<"high", "required">, import("convex/values").VLiteral<"critical", "required">], "required", never>;
        message: import("convex/values").VString<string, "required">;
        metadata: import("convex/values").VAny<any, "optional", string>;
        status: import("convex/values").VUnion<"active" | "resolved" | "suppressed", [import("convex/values").VLiteral<"active", "required">, import("convex/values").VLiteral<"resolved", "required">, import("convex/values").VLiteral<"suppressed", "required">], "required", never>;
        resolvedAt: import("convex/values").VFloat64<number | undefined, "optional">;
        suppressedBy: import("convex/values").VId<import("convex/values").GenericId<"users"> | undefined, "optional">;
        suppressedAt: import("convex/values").VFloat64<number | undefined, "optional">;
        suppressionReason: import("convex/values").VString<string | undefined, "optional">;
        suppressedUntil: import("convex/values").VFloat64<number | undefined, "optional">;
        updatedAt: import("convex/values").VFloat64<number, "required">;
    }, "required", "message" | "status" | "metadata" | "updatedAt" | `metadata.${string}` | "tenantId" | "integrationId" | "siteId" | "integrationSlug" | "dataSourceId" | "entityId" | "alertType" | "severity" | "resolvedAt" | "suppressedBy" | "suppressedAt" | "suppressionReason" | "suppressedUntil">, {
        by_tenant: ["tenantId", "_creationTime"];
        by_site: ["siteId", "tenantId", "_creationTime"];
        by_site_integration: ["siteId", "integrationId", "tenantId", "_creationTime"];
        by_data_source: ["dataSourceId", "tenantId", "_creationTime"];
        by_entity: ["entityId", "tenantId", "_creationTime"];
        by_type: ["alertType", "tenantId", "_creationTime"];
        by_severity: ["severity", "tenantId", "_creationTime"];
        by_status: ["status", "tenantId", "_creationTime"];
        by_entity_status: ["entityId", "status", "tenantId", "_creationTime"];
    }, {}, {}>;
    data_source_to_site: import("convex/server").TableDefinition<import("convex/values").VObject<{
        deletedAt?: number | undefined;
        tenantId: import("convex/values").GenericId<"tenants">;
        integrationId: import("convex/values").GenericId<"integrations">;
        siteId: import("convex/values").GenericId<"sites">;
        dataSourceId: import("convex/values").GenericId<"data_sources">;
    }, {
        tenantId: import("convex/values").VId<import("convex/values").GenericId<"tenants">, "required">;
        integrationId: import("convex/values").VId<import("convex/values").GenericId<"integrations">, "required">;
        dataSourceId: import("convex/values").VId<import("convex/values").GenericId<"data_sources">, "required">;
        siteId: import("convex/values").VId<import("convex/values").GenericId<"sites">, "required">;
        deletedAt: import("convex/values").VFloat64<number | undefined, "optional">;
    }, "required", "deletedAt" | "tenantId" | "integrationId" | "siteId" | "dataSourceId">, {
        by_tenant: ["tenantId", "_creationTime"];
        by_integration: ["integrationId", "tenantId", "_creationTime"];
        by_data_source: ["dataSourceId", "tenantId", "_creationTime"];
        by_site: ["siteId", "tenantId", "_creationTime"];
    }, {}, {}>;
}, true>;
export default _default;
//# sourceMappingURL=schema.d.ts.map