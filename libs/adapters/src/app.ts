import Debug from "@workspace/shared/lib/Debug";
import Fastify from "fastify";
import { IAdapter } from "src/adapter.js";
import { AutoTaskAdapter } from "src/psa/autotask.js";
import JobScheduler from "src/scheduler.js";

const fastify = Fastify({ logger: true });

fastify.get("/health", async () => ({
  service: "adapters",
  status: "healthy",
  workers: ["psa"],
}));

class AdaptersService {
  private adapters = new Map<string, IAdapter>();

  constructor() {
    this.adapters.set("autotask", new AutoTaskAdapter());
  }

  async start() {
    await Promise.all([
      ...Array.from(this.adapters.values()).map((adapter) => adapter.start()),
      JobScheduler.start(),
    ]);

    await fastify.listen({ port: 3003, host: "0.0.0.0" });

    Debug.log({
      module: "Adapters",
      context: "Service",
      message: "Service started on port 3003",
    });
  }

  async shutdown() {
    await Promise.all([
      ...Array.from(this.adapters.values()).map((adapter) => adapter.stop()),
      JobScheduler.stop(),
    ]);

    Debug.log({
      module: "Adapters",
      context: "Service",
      message: "Service stopped",
    });
  }

  private async startJobProcessing() {
    setInterval(async () => {
      const jobs = [];
      const retryJobs = [];
    });
  }
}

const service = new AdaptersService();
service.start();

process.on("SIGTERM", () => service.shutdown());
process.on("SIGINT", () => service.shutdown());
