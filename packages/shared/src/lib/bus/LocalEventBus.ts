import { MessageHandler, IEventBus } from "@workspace/shared/lib/bus/EventBus";
import {
  EventNames,
  EventPayload,
  Events,
} from "@workspace/shared/types/events/index";

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

type LocalEvents = "auth.login" | "auth.logout";
export class LocalEventBus {
  private buses: {
    [K in LocalEvents]: SubBus<K>;
  };

  constructor() {
    this.buses = {
      "auth.login": new SubBus(),
      "auth.logout": new SubBus(),
    };
  }

  on<K extends LocalEvents>(event: K, listener: MessageHandler<K>) {
    this.buses[event].on(listener);
  }

  off<K extends LocalEvents>(event: K, listener: MessageHandler<K>) {
    this.buses[event].off(listener);
  }

  emit<K extends LocalEvents>(event: K, payload: Events[K]) {
    this.buses[event].emit(payload);
  }
}
