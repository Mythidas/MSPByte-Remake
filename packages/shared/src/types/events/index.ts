import { AuthEvents } from "@workspace/shared/types/events/auth";
import { GeneralEvents } from "@workspace/shared/types/events/general";
import { JobEvents } from "@workspace/shared/types/events/job";

export type Events = AuthEvents & JobEvents & GeneralEvents;
export type EventNames = keyof Events;
export type EventPayload<Name extends EventNames> = Events[Name];
