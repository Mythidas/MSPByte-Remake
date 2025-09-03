import Fastify from "fastify";
import Debug from "@workspace/shared/lib/Debug.js";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { IProcessor } from "@workspace/services/processors/processor.js";
import CompanyProcessor from "@workspace/services/processors/companies-processor.js";

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
  private processors: IProcessor[] = [];

  async start() {
    this.processors = [new CompanyProcessor()];

    await Promise.all(this.processors.map((p) => p.start()));
    await fastify.listen({ port: 3004, host: "0.0.0.0" });

    Debug.log({
      module: "Services",
      context: "Host",
      message: "Host started on port 3004",
    });
  }

  async shutdown() {
    await Promise.all(this.processors.map((p) => p.stop()));

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
