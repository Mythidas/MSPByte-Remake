import { AuthEvents } from "./auth.js";
import { CompanyEvents } from "@workspace/shared/types/events/companies.js";

export type Events = AuthEvents & CompanyEvents;
export type EventNames = keyof Events;
export type EventPayload<Name extends EventNames> = Events[Name];
