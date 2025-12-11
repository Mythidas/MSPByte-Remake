import type { Doc, Id } from "@workspace/database/convex/_generated/dataModel";
import type {
	EntityType,
	IntegrationId,
} from "@workspace/shared/types/integrations";

/**
 * ============================================================================
 * ENTITY & RELATIONSHIP TYPES
 * ============================================================================
 */

/**
 * Entity document type from database
 */
export type Entity = Doc<"entities">;

/**
 * Entity relationship document type from database
 */
export type Relationship = Doc<"entity_relationships">;

/**
 * Entity state (health level)
 */
export type EntityState = "low" | "normal" | "warn" | "critical";

/**
 * MFA coverage level for identity entities
 */
export type MFACoverage = "none" | "partial" | "full";

/**
 * ============================================================================
 * ANALYSIS CONTEXT
 * ============================================================================
 */

/**
 * Analysis context passed to all analyzers
 * Contains all data needed for analysis, loaded once and shared
 */
export interface AnalysisContext {
	// Identifiers
	tenantId: Id<"tenants">;
	integrationId: IntegrationId;
	dataSourceId: Id<"data_sources">;
	syncId: string;

	// Entities grouped by type
	entities: {
		identities: Entity[];
		policies: Entity[];
		licenses: Entity[];
		groups: Entity[];
		roles: Entity[];
		companies: Entity[];
		endpoints: Entity[];
		firewalls: Entity[];
	};

	// Relationships between entities
	relationships: Relationship[];

	// Helper methods for analyzers
	getEntity(id: Id<"entities">): Entity | undefined;
	getRelationships(entityId: Id<"entities">, type?: string): Relationship[];
	getChildEntities(parentId: Id<"entities">): Entity[];
	getParentEntity(childId: Id<"entities">): Entity | undefined;
}

/**
 * ============================================================================
 * ALERT TYPES
 * ============================================================================
 */

/**
 * Alert severity levels
 */
export type AlertSeverity = "low" | "medium" | "high" | "critical";

/**
 * Alert type identifiers
 */
export type AlertType =
	| "mfa-not-enforced"
	| "mfa-partial-enforced"
	| "policy-gap"
	| "license-waste"
	| "stale-user";

/**
 * Alert data structure (before saving to database)
 */
export interface Alert {
	entityId: Id<"entities">;
	alertType: AlertType;
	severity: AlertSeverity;
	message: string;
	fingerprint: string; // Unique identifier for deduplication
	metadata?: Record<string, any>;
}

/**
 * ============================================================================
 * ANALYZER TYPES
 * ============================================================================
 */

/**
 * Result returned by analyzers
 * Analyzers are pure functions that don't mutate state
 */
export interface AnalyzerResult {
	// Alerts to create/update
	alerts: Alert[];

	// Tags to add to entities (merged with existing tags)
	entityTags: Map<Id<"entities">, string[]>;

	// Entity states to set (highest severity wins)
	entityStates: Map<Id<"entities">, EntityState>;
}

/**
 * ============================================================================
 * PIPELINE JOB TYPES
 * ============================================================================
 */

/**
 * Pipeline job stages
 */
export type PipelineStage =
	| "adapter"
	| "processor"
	| "linker"
	| "analyzer"
	| "failed";

/**
 * Pipeline job metadata
 */
export interface PipelineJob {
	tenantId: Id<"tenants">;
	integrationId: IntegrationId;
	dataSourceId: Id<"data_sources">;
	entityType?: EntityType;
	syncId: string;
	stage: PipelineStage;
	startedAt: number;
	completedAt?: number;
}

/**
 * ============================================================================
 * ADAPTER TYPES
 * ============================================================================
 */

/**
 * Pagination info for adapters
 */
export interface PaginationInfo {
	hasMore: boolean;
	cursor?: string;
	nextUrl?: string;
}

/**
 * Raw entity data from external API
 */
export interface RawEntity {
	externalId: string;
	siteId?: string;
	rawData: any;
}

/**
 * Adapter fetch result
 */
export interface AdapterFetchResult {
	entities: RawEntity[];
	pagination?: PaginationInfo;
}

/**
 * ============================================================================
 * PROCESSOR TYPES
 * ============================================================================
 */

/**
 * Entity change type (for metrics)
 */
export type EntityChangeType = "created" | "updated" | "deleted" | "unchanged";

/**
 * Entity processing result
 */
export interface EntityProcessResult {
	entityId: Id<"entities">;
	changeType: EntityChangeType;
}

/**
 * ============================================================================
 * LINKER TYPES
 * ============================================================================
 */

/**
 * Relationship to create
 */
export interface RelationshipToCreate {
	parentEntityId: Id<"entities">;
	childEntityId: Id<"entities">;
	relationshipType: string;
	metadata?: Record<string, any>;
}

/**
 * Linker result
 */
export interface LinkerResult {
	relationshipsCreated: number;
	relationshipsUpdated: number;
	relationshipsDeleted: number;
}
