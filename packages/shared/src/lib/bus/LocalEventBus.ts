import {
  EventNames,
  EventPayload,
  Events,
} from "@workspace/shared/types/events/index";
import { IEventBus, MessageHandler } from "./EventBus.js";

export class SubBus<E extends EventNames> {
  private listeners: MessageHandler<E>[] = [];

  on(listener: MessageHandler<E>) {
    this.listeners.push(listener);
  }

  off(listener: MessageHandler<E>) {
    this.listeners = this.listeners.filter((l) => l !== listener);
  }

  emit(payload: EventPayload<E>) {
    this.listeners.forEach((l) => l(payload));
  }
}

export class LocalEventBus implements IEventBus {
  private buses: {
    [K in EventNames]: SubBus<K>;
  };

  constructor() {
    this.buses = Object.fromEntries(
      (Object.keys({} as Events) as EventNames[]).map((name) => [
        name,
        new SubBus<typeof name>(),
      ])
    ) as { [K in EventNames]: SubBus<K> };
  }

  on<K extends EventNames>(event: K, listener: MessageHandler<K>) {
    this.buses[event].on(listener);
  }

  off<K extends EventNames>(event: K, listener: MessageHandler<K>) {
    this.buses[event].off(listener);
  }

  emit<K extends EventNames>(event: K, payload: Events[K]) {
    this.buses[event].emit(payload);
  }
}
