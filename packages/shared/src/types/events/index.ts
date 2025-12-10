import {
  PipelineEventPayload,
  EventName as PipelineEventName,
  EventPayloadByName,
} from "@workspace/shared/types/integrations";

// Combined event system that includes both legacy and pipeline events
export type Events = {
  [K in PipelineEventName]: EventPayloadByName<K>;
};

export type EventNames = keyof Events;
export type EventPayload<Name extends EventNames> = Events[Name];

// Re-export pipeline event utilities
export type { PipelineEventPayload, PipelineEventName };
export { type EventPayloadByName } from "../integrations";
