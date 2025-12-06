import QueueManager from './queue/QueueManager.js';
import { natsClient } from './lib/nats.js';
import Logger from './lib/logger.js';
import TracingManager from './lib/tracing.js';

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
        phase: 'Phase 1 - Queue Infrastructure Only',
      },
    });

    // TODO: Phase 2 - Add adapters, processors, linkers
    // TODO: Phase 3 - Add DataContextLoader
    // TODO: Phase 4 - Add UnifiedAnalyzer

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      Logger.log({
        module: 'Main',
        context: 'shutdown',
        message: 'Received SIGTERM, shutting down gracefully',
      });

      await queueManager.shutdown();
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

      await queueManager.shutdown();
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
