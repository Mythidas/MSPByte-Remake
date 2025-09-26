// Core pipeline types that define the stages and entities in the data processing pipeline

// All possible stages in the pipeline
export type PipelineStage =
  | "sync" // Initial sync request from scheduler
  | "fetched" // Data fetched from external API
  | "processed" // Data normalized and stored as entities
  | "resolved" // Special stage for data that doesn't need entity storage
  | "linked" // Relationships created between entities
  | "completed" // Final stage, processing complete
  | "failed"; // Error state

// All entity types that can flow through the pipeline
export type EntityType =
  | "companies"
  | "endpoints"
  | "contacts"
  | "tickets"
  | "assets"
  | "identities"
  | "users"
  | "licenses"
  | "license_assignments"
  | "billing_records"
  | "groups";

// Integration types for adapter identification
export type IntegrationType =
  | "autotask"
  | "microsoft-365"
  | "sophos-partner"
  | "datto";

// Template literal type for generating event names
export type EventName<
  Stage extends PipelineStage = PipelineStage,
  Entity extends EntityType = EntityType,
> = `${Stage}.${Entity}`;

// Base event structure that all pipeline events extend
export type BasePipelineEvent = {
  eventID: string;
  tenantID: string;
  integrationID: string;
  integrationType: IntegrationType;
  dataSourceID: string;
  entityType: EntityType;
  stage: PipelineStage;
  createdAt: string;
  parentEventID?: string; // For tracing event chains
};

// Metadata for routing and processing decisions
export type PipelineMetadata = {
  processingRules?: {
    skipStages?: PipelineStage[];
    customNextStage?: PipelineStage;
    requiresManualReview?: boolean;
  };
  sourceIntegration?: IntegrationType;
  destinationStage?: PipelineStage;
};
