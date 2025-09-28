import { AuthEvents } from "@workspace/shared/types/events/auth.js";
import {
  PipelineEventPayload,
  EventName as PipelineEventName,
  EventPayloadByName,
} from "@workspace/shared/types/pipeline";

// Legacy event system
export type LegacyEvents = AuthEvents;

// Combined event system that includes both legacy and pipeline events
export type Events = LegacyEvents & {
  [K in PipelineEventName]: EventPayloadByName<K>;
};

export type EventNames = keyof Events;
export type EventPayload<Name extends EventNames> = Events[Name];

// Re-export pipeline event utilities
export type { PipelineEventPayload, PipelineEventName };
export { type EventPayloadByName } from "../pipeline";
