import { LocalEventMap } from "@/lib/types/events";

type LocalEventHandler<E extends keyof LocalEventMap> = (
  payload: LocalEventMap[E]
) => void;

class SubBus<E extends keyof LocalEventMap> {
  private listeners: LocalEventHandler<E>[] = [];

  on(listener: LocalEventHandler<E>) {
    this.listeners.push(listener);
  }

  off(listener: LocalEventHandler<E>) {
    this.listeners = this.listeners.filter((l) => l !== listener);
  }

  emit(payload: LocalEventMap[E]) {
    this.listeners.forEach((l) => l(payload));
  }
}

export class LocalEventBus {
  private buses: {
    [K in keyof LocalEventMap]: SubBus<K>;
  };

  constructor() {
    this.buses = {
      "auth:login": new SubBus<"auth:login">(),
      "auth:logout": new SubBus<"auth:logout">(),
    };
  }

  on<K extends keyof LocalEventMap>(event: K, listener: LocalEventHandler<K>) {
    this.buses[event].on(listener);
  }

  off<K extends keyof LocalEventMap>(event: K, listener: LocalEventHandler<K>) {
    this.buses[event].off(listener);
  }

  emit<K extends keyof LocalEventMap>(event: K, payload: LocalEventMap[K]) {
    this.buses[event].emit(payload);
  }
}

export const localEventBus = new LocalEventBus();
