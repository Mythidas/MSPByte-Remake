import { AuthEvents } from "@workspace/shared/types/events/auth";
import { CompanyEvents } from "@workspace/shared/types/events/companies";
import { EndpointEvents } from "@workspace/shared/types/events/endpoints";

export type Events = AuthEvents & CompanyEvents & EndpointEvents;
export type EventNames = keyof Events;
export type EventPayload<Name extends EventNames> = Events[Name];
