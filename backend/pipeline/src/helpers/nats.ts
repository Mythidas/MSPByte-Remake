import { connect, NatsConnection, Subscription, StringCodec } from "nats";
import Debug from "@workspace/shared/lib/Debug.js";

const sc = StringCodec();

class NatsClient {
  private connection: NatsConnection | null = null;

  async connect(): Promise<void> {
    if (this.connection) return;

    try {
      this.connection = await connect({
        servers: process.env.NATS_URL || "nats://localhost:4222",
      });
      Debug.log({
        module: "NatsClient",
        context: "connect",
        message: "Connected to NATS server",
      });
    } catch (error) {
      Debug.error({
        module: "NatsClient",
        context: "connect",
        message: "Failed to connect to NATS",
        code: "NATS_CONNECT_FAILED",
      });
      throw error;
    }
  }

  async publish(subject: string, data: any): Promise<void> {
    if (!this.connection) {
      throw new Error("NATS not connected");
    }

    const payload = JSON.stringify(data);
    this.connection.publish(subject, sc.encode(payload));
    Debug.log({
      module: "NatsClient",
      context: "publish",
      message: `Published to ${subject}`,
    });
  }

  async subscribe(
    subject: string,
    handler: (data: any) => Promise<void>
  ): Promise<Subscription> {
    if (!this.connection) {
      throw new Error("NATS not connected");
    }

    const sub = this.connection.subscribe(subject);
    Debug.log({
      module: "NatsClient",
      context: "subscribe",
      message: `Subscribed to ${subject}`,
    });

    // Process messages
    (async () => {
      for await (const msg of sub) {
        try {
          const data = JSON.parse(sc.decode(msg.data));
          await handler(data);
        } catch (error) {
          Debug.error({
            module: "NatsClient",
            context: "subscribe",
            message: `Error processing message from ${subject}: ${error}`,
            code: "NATS_MESSAGE_ERROR",
          });
        }
      }
    })();

    return sub;
  }

  async close(): Promise<void> {
    if (this.connection) {
      await this.connection.close();
      this.connection = null;
      Debug.log({
        module: "NatsClient",
        context: "close",
        message: "Disconnected from NATS server",
      });
    }
  }
}

export const natsClient = new NatsClient();
