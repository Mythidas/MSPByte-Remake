// Main pipeline type system exports
export * from "./core.js";
export * from "./flows.js";
export * from "./events.js";
export * from "./resolver.js";

// Convenience re-exports for common use cases
export {
  type EventName,
  type PipelineStage,
  type EntityType,
  type IntegrationType,
  type BasePipelineEvent,
  type PipelineMetadata,
} from "@workspace/shared/types/pipeline/core.js";

export {
  type StandardFlow,
  type CustomFlow,
  type FlowResolver,
  StandardFlows,
  CustomFlows,
} from "@workspace/shared/types/pipeline/flows.js";

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
} from "@workspace/shared/types/pipeline/events.js";

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
} from "@workspace/shared/types/pipeline/resolver.js";
