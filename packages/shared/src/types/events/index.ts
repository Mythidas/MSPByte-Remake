import { AuthEvents } from "./auth.js";

export type Events = AuthEvents;
export type EventNames = keyof Events;
export type EventPayload<Name extends EventNames> = Events[Name];
