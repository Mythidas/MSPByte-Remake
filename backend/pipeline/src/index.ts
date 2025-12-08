// Load environment variables from .env file
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../.env') });

import QueueManager from './queue/QueueManager.js';
import { natsClient } from './lib/nats.js';
import Logger from './lib/logger.js';

// Phase 2: Adapters, Processors, Linkers
import { Microsoft365Adapter } from './adapters/Microsoft365Adapter.js';
import { IdentityProcessor } from './processors/IdentityProcessor.js';
import { CompanyProcessor } from './processors/CompanyProcessor.js';
import { EndpointProcessor } from './processors/EndpointProcessor.js';
import { FirewallProcessor } from './processors/FirewallProcessor.js';
import { GroupProcessor } from './processors/GroupProcessor.js';
import { LicenseProcessor } from './processors/LicenseProcessor.js';
import { PolicyProcessor } from './processors/PolicyProcessor.js';
import { RoleProcessor } from './processors/RoleProcessor.js';
import { Microsoft365Linker } from './linkers/Microsoft365Linker.js';

// Phase 4: UnifiedAnalyzer
import { UnifiedAnalyzer } from './analyzers/UnifiedAnalyzer.js';

// Phase 5: AlertManager
import { AlertManager } from './analyzers/AlertManager.js';

// Phase 7: HTTP Server and JobScheduler
import { startServer } from './server.js';
import { JobScheduler } from './scheduler/JobScheduler.js';

async function main() {
  Logger.log({
    module: 'Main',
    context: 'startup',
    message: 'Starting MSPByte Pipeline (Fresh Architecture)',
  });

  try {
    // Connect to NATS
    await natsClient.connect();
    Logger.log({
      module: 'Main',
      context: 'startup',
      message: 'NATS connected',
    });

    // Initialize Queue Manager
    const queueManager = new QueueManager();
    await queueManager.initialize();

    // Phase 2: Initialize Adapters
    Logger.log({
      module: 'Main',
      context: 'startup',
      message: 'Initializing Phase 2 components (Adapters, Processors, Linkers)',
    });

    const microsoft365Adapter = new Microsoft365Adapter();
    microsoft365Adapter.setQueueManager(queueManager);
    await microsoft365Adapter.start();
    Logger.log({
      module: 'Main',
      context: 'startup',
      message: 'Microsoft365Adapter started',
    });

    // Phase 2: Initialize Processors
    const identityProcessor = new IdentityProcessor();
    await identityProcessor.start();

    const companyProcessor = new CompanyProcessor();
    await companyProcessor.start();

    const endpointProcessor = new EndpointProcessor();
    await endpointProcessor.start();

    const firewallProcessor = new FirewallProcessor();
    await firewallProcessor.start();

    const groupProcessor = new GroupProcessor();
    await groupProcessor.start();

    const licenseProcessor = new LicenseProcessor();
    await licenseProcessor.start();

    const policyProcessor = new PolicyProcessor();
    await policyProcessor.start();

    const roleProcessor = new RoleProcessor();
    await roleProcessor.start();

    Logger.log({
      module: 'Main',
      context: 'startup',
      message: 'All processors started (8 processors)',
    });

    // Phase 2: Initialize Linker
    const microsoft365Linker = new Microsoft365Linker();
    await microsoft365Linker.start();
    Logger.log({
      module: 'Main',
      context: 'startup',
      message: 'Microsoft365Linker started',
    });

    // Phase 4: Initialize UnifiedAnalyzer
    const unifiedAnalyzer = new UnifiedAnalyzer();
    await unifiedAnalyzer.initialize();
    Logger.log({
      module: 'Main',
      context: 'startup',
      message: 'UnifiedAnalyzer initialized',
    });

    // Phase 5: Initialize AlertManager
    const alertManager = new AlertManager();
    await alertManager.start();
    Logger.log({
      module: 'Main',
      context: 'startup',
      message: 'AlertManager initialized',
    });

    // Phase 7: Start HTTP Server
    const port = parseInt(process.env.PORT || '3001', 10);
    const server = await startServer({ port, queueManager });
    Logger.log({
      module: 'Main',
      context: 'startup',
      message: `HTTP server started on port ${port}`,
      metadata: {
        endpoints: {
          health: `http://localhost:${port}/health`,
          metrics: `http://localhost:${port}/metrics`,
          api: `http://localhost:${port}/api`,
        },
      },
    });

    // Phase 7: Initialize JobScheduler
    const jobScheduler = new JobScheduler(queueManager);
    try {
      await jobScheduler.initialize();
      Logger.log({
        module: 'Main',
        context: 'startup',
        message: 'JobScheduler initialized',
        metadata: {
          scheduledJobs: jobScheduler.getScheduledJobs().length,
        },
      });
    } catch (error) {
      Logger.log({
        module: 'Main',
        context: 'startup',
        message: 'JobScheduler initialization failed (check CONVEX_URL and CONVEX_API_KEY)',
        level: 'warn',
        error: error as Error,
      });
    }

    // Health check loop
    setInterval(async () => {
      const health = await queueManager.healthCheck();

      if (!health.healthy) {
        Logger.log({
          module: 'Main',
          context: 'healthCheck',
          message: 'QueueManager unhealthy',
          level: 'warn',
          metadata: health,
        });
      }
    }, 30000); // Every 30 seconds

    // Stats logging
    setInterval(async () => {
      const stats = await queueManager.getStats();
      Logger.log({
        module: 'Main',
        context: 'stats',
        message: 'Queue statistics',
        metadata: stats,
      });
    }, 60000); // Every minute

    Logger.log({
      module: 'Main',
      context: 'startup',
      message: 'Pipeline started successfully',
      metadata: {
        phase: 'Phase 7 Complete - Production Ready (Full Pipeline + Monitoring + Scheduler)',
        components: {
          adapters: 1,
          processors: 8,
          linkers: 1,
          analyzers: 1,
          alertManagers: 1,
          httpServer: 1,
          jobScheduler: 1,
        },
        infrastructure: {
          port,
          queueConcurrency: parseInt(process.env.QUEUE_CONCURRENCY || '20', 10),
          scheduledJobs: jobScheduler.getScheduledJobs().length,
        },
      },
    });

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      Logger.log({
        module: 'Main',
        context: 'shutdown',
        message: 'Received SIGTERM, shutting down gracefully',
      });

      // Close HTTP server
      await new Promise((resolve) => server.close(resolve));
      // Stop job scheduler
      await jobScheduler.stop();
      // Close queue
      await queueManager.shutdown();
      // Close NATS
      await natsClient.close();

      Logger.log({
        module: 'Main',
        context: 'shutdown',
        message: 'Shutdown complete',
      });

      process.exit(0);
    });

    process.on('SIGINT', async () => {
      Logger.log({
        module: 'Main',
        context: 'shutdown',
        message: 'Received SIGINT, shutting down gracefully',
      });

      // Close HTTP server
      await new Promise((resolve) => server.close(resolve));
      // Stop job scheduler
      await jobScheduler.stop();
      // Close queue
      await queueManager.shutdown();
      // Close NATS
      await natsClient.close();

      Logger.log({
        module: 'Main',
        context: 'shutdown',
        message: 'Shutdown complete',
      });

      process.exit(0);
    });
  } catch (error) {
    Logger.log({
      module: 'Main',
      context: 'startup',
      message: 'Fatal error during startup',
      level: 'error',
      error: error as Error,
    });
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
