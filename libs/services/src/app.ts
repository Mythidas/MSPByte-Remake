import Fastify from "fastify";
import Debug from "@workspace/shared/lib/Debug.js";
import { NatsConnection, JSONCodec, connect, Subscription } from "nats";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// Compute __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, "../../../.env.local") });

const fastify = Fastify({ logger: true });

fastify.get("/health", async () => ({
  service: "services",
  status: "healthy",
}));

class ServicesHost {
  private nats: NatsConnection | undefined;
  private jc = JSONCodec();
  private subscription: Subscription | null = null;

  async start() {
    this.nats = await connect({ servers: process.env.NATS_URL });

    this.subscription = this.nats.subscribe("*.companies.fetched", {
      callback: (err, msg) => {
        if (err) {
          console.log(err);
          return;
        }

        try {
          const eventData = this.jc.decode(msg.data);
          console.log(eventData);
        } catch {}
      },
    });

    await fastify.listen({ port: 3004, host: "0.0.0.0" });

    Debug.log({
      module: "Services",
      context: "Host",
      message: "Host started on port 3004",
    });
  }

  async shutdown() {
    Debug.log({
      module: "Adapters",
      context: "Host",
      message: "Host stopped",
    });
  }
}

const service = new ServicesHost();
service.start();

process.on("SIGTERM", () => service.shutdown());
process.on("SIGINT", () => service.shutdown());
