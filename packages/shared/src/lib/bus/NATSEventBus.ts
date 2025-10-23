import { connect, NatsConnection } from "nats";
import {
  EventNames,
  EventPayload,
  Events,
} from "@workspace/shared/types/events/index";
import Debug from "@workspace/shared/lib/Debug";
import { MessageHandler, IEventBus } from "@workspace/shared/lib/bus/EventBus";

export class SubBus<E extends EventNames> {
  listeners: MessageHandler<E>[] = [];

  on(listener: MessageHandler<E>) {
    this.listeners.push(listener);
  }

  off(listener: MessageHandler<E>) {
    this.listeners = this.listeners.filter((l) => l !== listener);
  }
}

export class NATSEventBus implements IEventBus {
  private buses: {
    [K in EventNames]: SubBus<K>;
  };
  private nc: NatsConnection | null = null;

  constructor() {
    this.buses = Object.fromEntries(
      (Object.keys({} as Events) as EventNames[]).map((name) => [
        name,
        new SubBus<typeof name>(),
      ])
    ) as { [K in EventNames]: SubBus<K> };

    this.open();
  }

  private async open() {
    try {
      const server = { servers: "0.0.0.0:4222" };
      this.nc = await connect(server);
    } catch (err) {
      Debug.error({
        module: "NATSEventBus",
        context: "open",
        message: `Failed to open NATS connection: ${err}`,
      });
    }
  }

  on<K extends EventNames>(event: K, listener: MessageHandler<K>) {
    this.buses[event].on(listener);
  }

  off<K extends EventNames>(event: K, listener: MessageHandler<K>) {
    this.buses[event].off(listener);
  }

  emit<K extends EventNames>(event: K, payload: EventPayload<K>) {
    this.buses[event].listeners.forEach((l) => l(payload));
  }
}
