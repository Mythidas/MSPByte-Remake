// Main pipeline type system exports
export * from "./core";
export * from "./flows";
export * from "./events";
export * from "./resolver";

// Convenience re-exports for common use cases
export {
  type EventName,
  type PipelineStage,
  type EntityType,
  type IntegrationType,
  type BasePipelineEvent,
  type PipelineMetadata,
} from "@workspace/shared/types/pipeline/core";

export {
  type StandardFlow,
  type CustomFlow,
  type FlowResolver,
  StandardFlows,
  CustomFlows,
} from "@workspace/shared/types/pipeline/flows";

export {
  type PipelineEventPayload,
  type EventPayloadByStage,
  type EventPayloadByName,
  type TypeSafeEventPublisher,
  type TypeSafeEventSubscriber,
  type SyncEventPayload,
  type FetchedEventPayload,
  type ProcessedEventPayload,
  type ResolvedEventPayload,
  type LinkedEventPayload,
  type CompletedEventPayload,
  type FailedEventPayload,
} from "@workspace/shared/types/pipeline/events";

export {
  flowResolver,
  buildEventName,
  parseEventName,
  validateEventFlow,
  isSyncEvent,
  isFetchedEvent,
  isProcessedEvent,
  isResolvedEvent,
  isLinkedEvent,
  isCompletedEvent,
  isFailedEvent,
} from "@workspace/shared/types/pipeline/resolver";
