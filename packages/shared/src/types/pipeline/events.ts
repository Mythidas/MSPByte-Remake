import { Doc, Id } from "@workspace/database/convex/_generated/dataModel.js";
import {
  BasePipelineEvent,
  PipelineStage,
  EntityType,
  EventName,
  PipelineMetadata,
  IntegrationType,
} from "@workspace/shared/types/pipeline/core";

// Stage-specific payload interfaces
export type SyncEventPayload = BasePipelineEvent & {
  stage: "sync";
  job: Doc<"scheduled_jobs">;
};

export interface FetchedEventPayload extends BasePipelineEvent {
  stage: "fetched";
  data: DataFetchPayload[];
  total: number;
  hasMore?: boolean;
  nextPageToken?: string;
  syncMetadata?: {
    syncId: string;
    batchNumber: number;
    isFinalBatch: boolean;
    cursor?: string;
  };
}

export interface ProcessedEventPayload extends BasePipelineEvent {
  stage: "processed";
  entityIDs: string[];
  entitiesCreated: number;
  entitiesUpdated: number;
  entitiesSkipped: number;
  changedEntityIds?: Id<"entities">[]; // IDs of entities that were created or updated
  syncMetadata?: {
    syncId: string;
    batchNumber: number;
    isFinalBatch: boolean;
    cursor?: string;
  };
}

export interface ResolvedEventPayload extends BasePipelineEvent {
  stage: "resolved";
  resolvedData: ResolvedDataPayload[];
  skipEntityStorage: boolean;
  customProcessingComplete: boolean;
}

export interface LinkedEventPayload extends BasePipelineEvent {
  stage: "linked";
  relationshipsCreated: EntityRelationship[];
  relationshipsUpdated: EntityRelationship[];
  changedEntityIds?: Id<"entities">[]; // IDs of entities affected by linking operations
  syncMetadata?: {
    syncId: string;
    batchNumber: number;
    isFinalBatch: boolean;
    cursor?: string;
  };
}

export interface CompletedEventPayload extends BasePipelineEvent {
  stage: "completed";
  summary: ProcessingSummary;
  duration: number;
}

export interface FailedEventPayload extends BasePipelineEvent {
  stage: "failed";
  error: {
    message: string;
    details?: any;
    retryable: boolean;
  };
  failedAt: PipelineStage;
}

// Payload data structures
export type DataFetchPayload = {
  externalID: string;
  siteID?: string;
  dataHash: string;
  rawData: any;
};

export type ResolvedDataPayload = {
  externalID: string;
  resolvedData: any;
  targetEntityType?: EntityType;
  customFields?: Record<string, any>;
};

export type EntityRelationship = {
  id: string;
  sourceEntityType: EntityType;
  sourceEntityID: string;
  targetEntityType: EntityType;
  targetEntityID: string;
  relationshipType: string;
  metadata?: Record<string, any>;
};

export type ProcessingSummary = {
  totalProcessed: number;
  entitiesCreated: number;
  entitiesUpdated: number;
  relationshipsCreated: number;
  errors: number;
  warnings: string[];
};

// Union type of all possible event payloads
export type PipelineEventPayload =
  | SyncEventPayload
  | FetchedEventPayload
  | ProcessedEventPayload
  | ResolvedEventPayload
  | LinkedEventPayload
  | CompletedEventPayload
  | FailedEventPayload;

// Mapped type to get event payload by stage
export type EventPayloadByStage<S extends PipelineStage> = S extends "sync"
  ? SyncEventPayload
  : S extends "fetched"
    ? FetchedEventPayload
    : S extends "processed"
      ? ProcessedEventPayload
      : S extends "resolved"
        ? ResolvedEventPayload
        : S extends "linked"
          ? LinkedEventPayload
          : S extends "completed"
            ? CompletedEventPayload
            : S extends "failed"
              ? FailedEventPayload
              : never;

// Type for getting event payload by event name
export type EventPayloadByName<T extends EventName> =
  T extends `${infer Stage}.${infer Entity}`
    ? Stage extends PipelineStage
      ? Entity extends EntityType
        ? EventPayloadByStage<Stage> & { entityType: Entity }
        : never
      : never
    : never;

// Helper type for creating type-safe event publishers
export interface TypeSafeEventPublisher {
  publish<T extends EventName>(
    eventName: T,
    payload: EventPayloadByName<T> & { metadata?: PipelineMetadata }
  ): Promise<void>;
}

// Helper type for creating type-safe event subscribers
export interface TypeSafeEventSubscriber {
  subscribe<T extends EventName>(
    eventPattern: T | `${IntegrationType}.${T}` | `*.${PipelineStage}.*`,
    handler: (payload: EventPayloadByName<T>) => Promise<void>
  ): Promise<void>;
}
