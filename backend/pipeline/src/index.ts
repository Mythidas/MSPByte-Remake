// Load environment variables from .env file
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, "../.env") });

import { Logger } from "./lib/logger.js";
import { Microsoft365Adapter } from "./adapters/Microsoft365Adapter.js";
import { EntityProcessor } from "./processor/EntityProcessor.js";
import { Microsoft365Linker } from "./linkers/Microsoft365Linker.js";
import { AnalysisOrchestrator } from "./analyzers/AnalysisOrchestrator.js";
import { MFAAnalyzer } from "./analyzers/MFAAnalyzer.js";
import { SyncScheduler } from "./scheduler/SyncScheduler.js";
import { HaloPSAAdapter } from "./adapters/HaloPSAAdapter.js";

/**
 * Pipeline Entry Point
 *
 * Initializes all pipeline components:
 * 1. Adapters - Fetch data from external APIs
 * 2. Processor - Create/update entities in database
 * 3. Linkers - Create relationships between entities
 * 4. Analyzers - Generate alerts and tags
 * 5. Scheduler - Schedule initial sync jobs
 *
 * Pipeline flow:
 * sync:{integration}:{type} → process:entity → link:{integration} → analyze:tenant
 */

async function main() {
  Logger.level = "trace";
  Logger.log({
    module: "Pipeline",
    context: "main",
    message: "Starting pipeline...",
    level: "info",
  });

  // Validate required environment variables
  const requiredEnvVars = [
    "CONVEX_URL",
    "CONVEX_API_KEY",
    "REDIS_HOST",
    "REDIS_PORT",
  ];

  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      throw new Error(`Missing required environment variable: ${envVar}`);
    }
  }

  const convexUrl = process.env.CONVEX_URL!;

  // ============================================================================
  // STEP 1: Initialize Adapters (Fetch data from external APIs)
  // ============================================================================
  Logger.log({
    module: "Pipeline",
    context: "main",
    message: "Initializing adapters...",
    level: "info",
  });

  const microsoft365Adapter = new Microsoft365Adapter(convexUrl);

  // Start workers for each entity type
  microsoft365Adapter.startWorkerForType("identities");
  microsoft365Adapter.startWorkerForType("groups");
  microsoft365Adapter.startWorkerForType("licenses");
  microsoft365Adapter.startWorkerForType("roles");
  microsoft365Adapter.startWorkerForType("policies");

  const halopsaAdapter = new HaloPSAAdapter(convexUrl);

  halopsaAdapter.startWorkerForType("companies");

  Logger.log({
    module: "Pipeline",
    context: "main",
    message: "Adapters initialized",
    level: "info",
  });

  // ============================================================================
  // STEP 2: Initialize Processor (Create/update entities)
  // ============================================================================
  Logger.log({
    module: "Pipeline",
    context: "main",
    message: "Initializing entity processor...",
    level: "info",
  });

  const entityProcessor = new EntityProcessor(convexUrl);
  entityProcessor.start();

  Logger.log({
    module: "Pipeline",
    context: "main",
    message: "Entity processor initialized",
    level: "info",
  });

  // ============================================================================
  // STEP 3: Initialize Linkers (Create relationships)
  // ============================================================================
  Logger.log({
    module: "Pipeline",
    context: "main",
    message: "Initializing linkers...",
    level: "info",
  });

  const microsoft365Linker = new Microsoft365Linker(convexUrl);
  microsoft365Linker.start();

  Logger.log({
    module: "Pipeline",
    context: "main",
    message: "Linkers initialized",
    level: "info",
  });

  // ============================================================================
  // STEP 4: Initialize Analyzers (Generate alerts and tags)
  // ============================================================================
  Logger.log({
    module: "Pipeline",
    context: "main",
    message: "Initializing analyzers...",
    level: "info",
  });

  const analyzers = [
    new MFAAnalyzer(),
    // Add more analyzers here as they're implemented
  ];

  const analysisOrchestrator = new AnalysisOrchestrator(convexUrl, analyzers);
  analysisOrchestrator.start();

  Logger.log({
    module: "Pipeline",
    context: "main",
    message: `Analysis orchestrator initialized with ${analyzers.length} analyzers`,
    level: "info",
  });

  // ============================================================================
  // STEP 5: Schedule Initial Sync Jobs
  // ============================================================================
  Logger.log({
    module: "Pipeline",
    context: "main",
    message: "Scheduling initial sync jobs...",
    level: "info",
  });

  const scheduler = new SyncScheduler(convexUrl);
  await scheduler.scheduleAllDatasources();

  Logger.log({
    module: "Pipeline",
    context: "main",
    message: "Initial sync jobs scheduled",
    level: "info",
  });

  // ============================================================================
  // STEP 6: Setup Graceful Shutdown
  // ============================================================================
  const shutdown = async (signal: string) => {
    Logger.log({
      module: "Pipeline",
      context: "shutdown",
      message: `Received ${signal}, shutting down gracefully...`,
      level: "info",
    });

    try {
      // Stop all workers
      await Promise.all([
        microsoft365Adapter.stop(),
        halopsaAdapter.stop(),
        entityProcessor.stop(),
        microsoft365Linker.stop(),
        analysisOrchestrator.stop(),
      ]);

      Logger.log({
        module: "Pipeline",
        context: "shutdown",
        message: "Graceful shutdown complete",
        level: "info",
      });

      process.exit(0);
    } catch (error) {
      Logger.log({
        module: "Pipeline",
        context: "shutdown",
        message: `Error during shutdown: ${error}`,
        level: "error",
      });

      process.exit(1);
    }
  };

  // Listen for shutdown signals
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  Logger.log({
    module: "Pipeline",
    context: "main",
    message: "Pipeline started successfully. Press Ctrl+C to stop.",
    level: "info",
  });
}

main().catch((error) => {
  Logger.log({
    module: "Pipeline",
    context: "main",
    message: `Fatal error: ${error}`,
    level: "error",
  });
  console.error("Fatal error:", error);
  process.exit(1);
});
