import { AutoTaskAdapter } from "@workspace/pipeline/adapters/AutoTaskAdapter.js";
import { BaseAdapter } from "@workspace/pipeline/adapters/BaseAdapter.js";
import { Microsoft365Adapter } from "@workspace/pipeline/adapters/Microsoft365Adpater.js";
import { SophosPartnerAdapter } from "@workspace/pipeline/adapters/SophosPartnerAdapter.js";
import { HaloPSAAdapter } from "@workspace/pipeline/adapters/HaloPSAAdapter.js";
import { natsClient } from "@workspace/pipeline/helpers/nats.js";
import { BaseLinker } from "@workspace/pipeline/linkers/BaseLinker.js";
import { BaseProcessor } from "@workspace/pipeline/processors/BaseProcessor.js";
import { CompanyProcessor } from "@workspace/pipeline/processors/CompanyProcessor.js";
import { EndpointProcessor } from "@workspace/pipeline/processors/EndpointProcessor.js";
import { FirewallProcessor } from "@workspace/pipeline/processors/FirewallProcessor.js";
import { GroupProcessor } from "@workspace/pipeline/processors/GroupProcessor.js";
import { IdentityProcessor } from "@workspace/pipeline/processors/IdentityProcessor.js";
import { BaseResolver } from "@workspace/pipeline/resolvers/BaseResolver.js";
import { Scheduler } from "@workspace/pipeline/scheduler/index.js";
import { BaseWorker } from "@workspace/pipeline/workers/base.js";
import Debug from "@workspace/shared/lib/Debug.js";
import { IntegrationType } from "@workspace/shared/types/pipeline/core.js";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

// Compute __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log(join(__dirname, "../../../../.env"));
dotenv.config({ path: join(__dirname, "../../../.env") });

class MSPByteBackend {
  private scheduler: Scheduler;
  private adapters: Map<IntegrationType, BaseAdapter>;
  private processors: BaseProcessor[];
  private resolvers: BaseResolver[];
  private linkers: BaseLinker[];
  private workers: BaseWorker[];

  constructor() {
    this.scheduler = new Scheduler();
    this.adapters = new Map([
      ["autotask", new AutoTaskAdapter() as BaseAdapter],
      ["sophos-partner", new SophosPartnerAdapter()],
      ["microsoft-365", new Microsoft365Adapter()],
      ["halopsa", new HaloPSAAdapter()],
    ]);

    // Initialize empty arrays - you'll add concrete implementations later
    this.processors = [
      new CompanyProcessor(),
      new EndpointProcessor(),
      new IdentityProcessor(),
      new GroupProcessor(),
      new FirewallProcessor(),
    ];
    this.resolvers = [];
    this.linkers = [];
    this.workers = [];
  }

  async start(): Promise<void> {
    try {
      Debug.log({
        module: "MSPByteBackend",
        context: "start",
        message: "Starting MSPByte Backend Services...",
      });

      // Connect to NATS
      await natsClient.connect();

      // Start pipeline stages in order
      Debug.log({
        module: "MSPByteBackend",
        context: "start",
        message: "Starting pipeline stages...",
      });

      // Start all adapters
      for await (const [name, adapter] of this.adapters) {
        Debug.log({
          module: "MSPByteBackend",
          context: "start",
          message: `Starting ${name} adapter...`,
        });
        await adapter.start();
      }

      // Start all processors
      for await (const processor of this.processors) {
        Debug.log({
          module: "MSPByteBackend",
          context: "start",
          message: `Starting ${processor.constructor.name}...`,
        });
        await processor.start();
      }

      // Start all resolvers
      for await (const resolver of this.resolvers) {
        Debug.log({
          module: "MSPByteBackend",
          context: "start",
          message: `Starting ${resolver.constructor.name}...`,
        });
        await resolver.start();
      }

      // Start all linkers
      for await (const linker of this.linkers) {
        Debug.log({
          module: "MSPByteBackend",
          context: "start",
          message: `Starting ${linker.constructor.name}...`,
        });
        await linker.start();
      }

      // Start all workers
      for await (const worker of this.workers) {
        Debug.log({
          module: "MSPByteBackend",
          context: "start",
          message: `Starting ${worker.constructor.name}...`,
        });
        await worker.start();
      }

      // Start scheduler
      await this.scheduler.start();

      Debug.log({
        module: "MSPByteBackend",
        context: "start",
        message: "MSPByte Backend Services started successfully",
      });

      // Keep the process running
      process.on("SIGINT", this.gracefulShutdown.bind(this));
      process.on("SIGTERM", this.gracefulShutdown.bind(this));
    } catch (error) {
      Debug.error({
        module: "MSPByteBackend",
        context: "start",
        message: "Failed to start MSPByte Backend Services",
      });
      process.exit(1);
    }
  }

  async gracefulShutdown(): Promise<void> {
    Debug.log({
      module: "MSPByteBackend",
      context: "gracefulShutdown",
      message: "Shutting down MSPByte Backend Services...",
    });

    try {
      // Stop scheduler
      await this.scheduler.stop();

      // Close NATS connection
      await natsClient.close();

      Debug.log({
        module: "MSPByteBackend",
        context: "gracefulShutdown",
        message: "MSPByte Backend Services shut down gracefully",
      });
      process.exit(0);
    } catch (error) {
      Debug.error({
        module: "MSPByteBackend",
        context: "gracefulShutdown",
        message: "Error during graceful shutdown",
      });
      process.exit(1);
    }
  }
}

// Start the application
const app = new MSPByteBackend();
app.start();

export { MSPByteBackend };
