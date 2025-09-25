import Debug from "@workspace/shared/lib/Debug";
import dotenv from "dotenv";
import { natsClient } from "@workspace/pipeline/shared/nats";
import { Scheduler } from "@workspace/pipeline/scheduler";
import { BaseResolver } from "@workspace/pipeline/resolvers/base";
import { BaseLinker } from "@workspace/pipeline/linkers/base";
import { BaseWorker } from "@workspace/pipeline/workers/base";
import { BaseProcessor } from "@workspace/pipeline/processors/BaseProcessor";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { AutoTaskAdapter } from "@workspace/pipeline/adapters/AutoTaskAdapter";
import { BaseAdapter } from "@workspace/pipeline/adapters/BaseAdapter";
import { Microsoft365Adapter } from "@workspace/pipeline/adapters/Microsoft365Adapter";
import { SophosAdapter } from "@workspace/pipeline/adapters/SophosAdapter";
import { CompanyProcessor } from "@workspace/pipeline/processors/CompanyProcessor";

// Compute __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, "../../../.env.local") });

class MSPByteBackend {
  private scheduler: Scheduler;
  private adapters: Map<string, any>;
  private processors: BaseProcessor[];
  private resolvers: BaseResolver[];
  private linkers: BaseLinker[];
  private workers: BaseWorker[];

  constructor() {
    this.scheduler = new Scheduler();
    this.adapters = new Map([
      ["microsoft365", new Microsoft365Adapter() as BaseAdapter],
      ["autotask", new AutoTaskAdapter()],
      ["sophos", new SophosAdapter()],
    ]);

    // Initialize empty arrays - you'll add concrete implementations later
    this.processors = [new CompanyProcessor()];
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
        code: "BACKEND_START_FAILED",
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
        code: "BACKEND_SHUTDOWN_FAILED",
      });
      process.exit(1);
    }
  }
}

// Start the application
const app = new MSPByteBackend();
app.start();

export { MSPByteBackend };
