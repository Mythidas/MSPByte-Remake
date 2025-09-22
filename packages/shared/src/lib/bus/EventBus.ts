import { EventNames, Events } from "@workspace/shared/types/events/index";

export type MessageHandler<K extends keyof Events> = (
  payload: Events[K]
) => void;

export interface IEventBus {
  on<K extends EventNames>(event: K, listener: MessageHandler<K>): void;
  off<K extends EventNames>(event: K, listener: MessageHandler<K>): void;
  emit<K extends EventNames>(event: K, payload: Events[K]): void;
}
