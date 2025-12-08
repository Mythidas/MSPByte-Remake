/**
 * HTTP Server - Production API & Metrics
 *
 * Provides:
 * - Prometheus metrics endpoint (/metrics)
 * - Health check endpoint (/health)
 * - Job scheduling API (/api/jobs/*)
 * - Feature flag API (/api/feature-flags/*)
 *
 * Usage:
 *   import { startServer } from './server.js';
 *   const server = await startServer(3001);
 */

import express, { type Request, type Response } from 'express';
import type { Server } from 'http';
import Logger from './lib/logger.js';
import { MetricsCollector } from './monitoring/metrics.js';
import { FeatureFlagManager } from './lib/featureFlags.js';
import { QueueManager } from './queue/QueueManager.js';
import { natsClient } from './lib/nats.js';
import RedisManager from './lib/redis.js';
import type { Id } from '@workspace/database/convex/_generated/dataModel.js';

export interface ServerConfig {
  port: number;
  queueManager: QueueManager;
}

/**
 * Start HTTP server with API endpoints
 */
export async function startServer(config: ServerConfig): Promise<Server> {
  const app = express();
  const { port, queueManager } = config;

  // Middleware
  app.use(express.json());

  // Request logging
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      Logger.log({
        module: 'HTTPServer',
        context: 'request',
        message: `${req.method} ${req.path} ${res.statusCode} ${duration}ms`,
      });
    });
    next();
  });

  // ============================================================================
  // HEALTH CHECK
  // ============================================================================

  app.get('/health', async (req: Request, res: Response) => {
    try {
      const redis = await RedisManager.ping();
      const nats = natsClient.isConnected();
      const workers = await queueManager.getWorkerStatus();

      const healthy = redis && nats && workers.activeCount >= 0;

      res.status(healthy ? 200 : 503).json({
        status: healthy ? 'healthy' : 'unhealthy',
        timestamp: Date.now(),
        services: {
          redis: redis ? 'connected' : 'disconnected',
          nats: nats ? 'connected' : 'disconnected',
          workers: {
            active: workers.activeCount,
            waiting: workers.waitingCount,
            concurrency: workers.concurrency,
          },
        },
      });
    } catch (error) {
      Logger.log({
        module: 'HTTPServer',
        context: 'health',
        message: `Health check failed: ${error}`,
        level: 'error',
        error: error as Error,
      });

      res.status(503).json({
        status: 'unhealthy',
        error: String(error),
      });
    }
  });

  // ============================================================================
  // PROMETHEUS METRICS
  // ============================================================================

  app.get('/metrics', async (req: Request, res: Response) => {
    try {
      const metrics = MetricsCollector.getInstance();
      const prometheusText = await metrics.getPrometheusMetrics();

      res.setHeader('Content-Type', 'text/plain; version=0.0.4');
      res.send(prometheusText);
    } catch (error) {
      Logger.log({
        module: 'HTTPServer',
        context: 'metrics',
        message: `Failed to generate metrics: ${error}`,
        level: 'error',
        error: error as Error,
      });

      res.status(500).json({ error: 'Failed to generate metrics' });
    }
  });

  // ============================================================================
  // METRICS SUMMARY (JSON)
  // ============================================================================

  app.get('/api/metrics/summary', (req: Request, res: Response) => {
    try {
      const metrics = MetricsCollector.getInstance();
      const summary = metrics.getSummary();

      res.json(summary);
    } catch (error) {
      Logger.log({
        module: 'HTTPServer',
        context: 'metrics-summary',
        message: `Failed to get metrics summary: ${error}`,
        level: 'error',
        error: error as Error,
      });

      res.status(500).json({ error: 'Failed to get metrics summary' });
    }
  });

  // ============================================================================
  // JOB SCHEDULING API
  // ============================================================================

  /**
   * POST /api/jobs/schedule
   * Schedule a new job
   *
   * Body:
   * {
   *   "action": "microsoft-365.sync.identities",
   *   "tenantId": "tenant_123",
   *   "dataSourceId": "ds_456",
   *   "priority": 5,      // Optional
   *   "delay": 0,         // Optional (ms)
   *   "metadata": {}      // Optional
   * }
   */
  app.post('/api/jobs/schedule', async (req: Request, res: Response) => {
    try {
      const { action, tenantId, dataSourceId, priority, delay, metadata } = req.body;

      if (!action || !tenantId || !dataSourceId) {
        return res.status(400).json({
          error: 'Missing required fields: action, tenantId, dataSourceId',
        });
      }

      const jobId = await queueManager.scheduleJob({
        action,
        tenantId: tenantId as Id<'tenants'>,
        dataSourceId: dataSourceId as Id<'data_sources'>,
        priority,
        delay,
        metadata,
      });

      Logger.log({
        module: 'HTTPServer',
        context: 'schedule-job',
        message: `Scheduled job ${jobId}`,
        metadata: { action, tenantId, dataSourceId },
      });

      res.status(201).json({
        jobId,
        action,
        tenantId,
        dataSourceId,
        scheduledAt: Date.now(),
      });
    } catch (error) {
      Logger.log({
        module: 'HTTPServer',
        context: 'schedule-job',
        message: `Failed to schedule job: ${error}`,
        level: 'error',
        error: error as Error,
      });

      res.status(500).json({ error: String(error) });
    }
  });

  /**
   * GET /api/jobs/:jobId
   * Get job status
   */
  app.get('/api/jobs/:jobId', async (req: Request, res: Response) => {
    try {
      const { jobId } = req.params;
      const status = await queueManager.getJobStatus(jobId);

      if (!status) {
        return res.status(404).json({ error: 'Job not found' });
      }

      res.json(status);
    } catch (error) {
      Logger.log({
        module: 'HTTPServer',
        context: 'get-job-status',
        message: `Failed to get job status: ${error}`,
        level: 'error',
        error: error as Error,
      });

      res.status(500).json({ error: String(error) });
    }
  });

  /**
   * GET /api/jobs
   * List jobs with optional status filter
   *
   * Query params:
   * - status: 'waiting' | 'active' | 'completed' | 'failed'
   * - limit: number (default 50, max 200)
   */
  app.get('/api/jobs', async (req: Request, res: Response) => {
    try {
      const status = req.query.status as 'waiting' | 'active' | 'completed' | 'failed' | undefined;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);

      const jobs = await queueManager.getJobs(status, limit);

      res.json({
        count: jobs.length,
        limit,
        status: status || 'all',
        jobs,
      });
    } catch (error) {
      Logger.log({
        module: 'HTTPServer',
        context: 'list-jobs',
        message: `Failed to list jobs: ${error}`,
        level: 'error',
        error: error as Error,
      });

      res.status(500).json({ error: String(error) });
    }
  });

  // ============================================================================
  // FEATURE FLAGS API
  // ============================================================================

  /**
   * GET /api/feature-flags
   * Get all feature flag statuses
   *
   * Query params:
   * - tenantId: Optional tenant ID to see effective values for that tenant
   */
  app.get('/api/feature-flags', (req: Request, res: Response) => {
    try {
      const tenantId = req.query.tenantId as Id<'tenants'> | undefined;
      const flags = FeatureFlagManager.getInstance();
      const statuses = flags.getAllStatuses(tenantId);

      res.json({
        tenantId: tenantId || null,
        flags: statuses,
      });
    } catch (error) {
      Logger.log({
        module: 'HTTPServer',
        context: 'get-feature-flags',
        message: `Failed to get feature flags: ${error}`,
        level: 'error',
        error: error as Error,
      });

      res.status(500).json({ error: String(error) });
    }
  });

  /**
   * POST /api/feature-flags/:flag/tenant/:tenantId
   * Set tenant-specific override
   *
   * Body:
   * {
   *   "enabled": true
   * }
   */
  app.post('/api/feature-flags/:flag/tenant/:tenantId', (req: Request, res: Response) => {
    try {
      const { flag, tenantId } = req.params;
      const { enabled } = req.body;

      if (typeof enabled !== 'boolean') {
        return res.status(400).json({ error: 'enabled must be a boolean' });
      }

      const flags = FeatureFlagManager.getInstance();
      flags.setTenantOverride(flag as any, tenantId as Id<'tenants'>, enabled);

      Logger.log({
        module: 'HTTPServer',
        context: 'set-tenant-override',
        message: `Set tenant override for ${flag}`,
        metadata: { flag, tenantId, enabled },
      });

      res.json({
        flag,
        tenantId,
        enabled,
        updated: true,
      });
    } catch (error) {
      Logger.log({
        module: 'HTTPServer',
        context: 'set-tenant-override',
        message: `Failed to set tenant override: ${error}`,
        level: 'error',
        error: error as Error,
      });

      res.status(500).json({ error: String(error) });
    }
  });

  /**
   * DELETE /api/feature-flags/:flag/tenant/:tenantId
   * Remove tenant-specific override
   */
  app.delete('/api/feature-flags/:flag/tenant/:tenantId', (req: Request, res: Response) => {
    try {
      const { flag, tenantId } = req.params;

      const flags = FeatureFlagManager.getInstance();
      flags.removeTenantOverride(flag as any, tenantId as Id<'tenants'>);

      Logger.log({
        module: 'HTTPServer',
        context: 'remove-tenant-override',
        message: `Removed tenant override for ${flag}`,
        metadata: { flag, tenantId },
      });

      res.json({
        flag,
        tenantId,
        removed: true,
      });
    } catch (error) {
      Logger.log({
        module: 'HTTPServer',
        context: 'remove-tenant-override',
        message: `Failed to remove tenant override: ${error}`,
        level: 'error',
        error: error as Error,
      });

      res.status(500).json({ error: String(error) });
    }
  });

  // ============================================================================
  // ERROR HANDLING
  // ============================================================================

  // 404 handler
  app.use((req: Request, res: Response) => {
    res.status(404).json({
      error: 'Not found',
      path: req.path,
    });
  });

  // Global error handler
  app.use((err: Error, req: Request, res: Response, next: any) => {
    Logger.log({
      module: 'HTTPServer',
      context: 'error',
      message: `Unhandled error: ${err.message}`,
      level: 'error',
      error: err,
    });

    res.status(500).json({
      error: 'Internal server error',
      message: err.message,
    });
  });

  // ============================================================================
  // START SERVER
  // ============================================================================

  return new Promise((resolve, reject) => {
    try {
      const server = app.listen(port, () => {
        Logger.log({
          module: 'HTTPServer',
          context: 'startup',
          message: `HTTP server listening on port ${port}`,
          metadata: {
            endpoints: {
              health: `http://localhost:${port}/health`,
              metrics: `http://localhost:${port}/metrics`,
              jobs: `http://localhost:${port}/api/jobs`,
              featureFlags: `http://localhost:${port}/api/feature-flags`,
            },
          },
        });

        resolve(server);
      });

      server.on('error', (error) => {
        Logger.log({
          module: 'HTTPServer',
          context: 'startup',
          message: `Failed to start server: ${error}`,
          level: 'error',
          error,
        });
        reject(error);
      });
    } catch (error) {
      reject(error);
    }
  });
}

export default startServer;
