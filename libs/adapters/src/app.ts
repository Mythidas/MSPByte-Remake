import { getRows } from "@workspace/shared/lib/db/orm.js";
import Debug from "@workspace/shared/lib/Debug";
import Fastify from "fastify";
import { IAdapter } from "src/adapter.js";
import { AutoTaskAdapter } from "src/psa/autotask.js";
import JobScheduler from "src/scheduler.js";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { SophosPartnerAdapter } from "src/security/sophos-partner.js";

// Compute __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, "../../../.env.local") });

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
    this.adapters.set("sophos-partner", new SophosPartnerAdapter());
  }

  async start() {
    await Promise.all([
      ...Array.from(this.adapters.values()).map((adapter) => adapter.start()),
      JobScheduler.start(),
    ]);

    this.startJobProcessing();
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
      const [jobs, retryJobs] = await Promise.all([
        getRows("scheduled_jobs", {
          filters: [["status", "eq", "pending"]],
        }),
        getRows("scheduled_jobs", {
          filters: [["status", "eq", "failed"]],
        }),
      ]);

      const allJobs = [
        ...(jobs.data ? jobs.data.rows : []),
        ...(retryJobs.data ? retryJobs.data.rows : []),
      ];

      JobScheduler.claimJobs(allJobs);

      for (const job of allJobs) {
        switch (job.integration_id) {
          case "autotask": {
            this.adapters.get("autotask")?.processJob(job);
            continue;
          }
          case "sophos-partner": {
            this.adapters.get("sophos-partner")?.processJob(job);
            continue;
          }
        }
      }

      if (allJobs.length) {
        Debug.log({
          module: "Adapters",
          context: "startJobProcessing",
          message: `Processed ${allJobs.length} jobs [${jobs.data?.total || 0} jobs | ${retryJobs.data?.total || 0} retries]`,
        });
      }
    }, 5000);
  }
}

const service = new AdaptersService();
service.start();

process.on("SIGTERM", () => service.shutdown());
process.on("SIGINT", () => service.shutdown());
