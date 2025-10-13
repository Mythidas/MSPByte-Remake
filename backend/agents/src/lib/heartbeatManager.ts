import Redis from "ioredis";
import Debug from "@workspace/shared/lib/Debug.js";
import { api } from "@workspace/database/convex/_generated/api.js";
import type { Id } from "@workspace/database/convex/_generated/dataModel.js";
import { client } from "@workspace/shared/lib/convex.js";

type AgentStatus = "online" | "offline" | "unknown";

interface HeartbeatData {
  lastHeartbeat: number;
  status: AgentStatus;
}

interface StatusUpdate {
  id: Id<"agents">;
  status: AgentStatus;
  statusChangedAt: number;
  lastCheckinAt?: number;
}

export class HeartbeatManager {
  private redis: Redis;
  private staleCheckInterval?: NodeJS.Timeout;
  private syncInterval?: NodeJS.Timeout;
  private statusUpdateQueue: StatusUpdate[] = [];
  private readonly STALE_THRESHOLD_MS = 3 * 60 * 1000; // 3 minutes
  private readonly STALE_CHECK_INTERVAL_MS = 30 * 1000; // 30 seconds
  private readonly SYNC_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
  private readonly BATCH_SIZE = 50; // Max updates per batch
  private isRunning = false;

  constructor(redisUrl?: string) {
    this.redis = new Redis(redisUrl || process.env.REDIS_URL || "", {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });

    this.redis.on("connect", () => {
      Debug.log({
        module: "HeartbeatManager",
        context: "constructor",
        message: "Connected to Redis",
      });
    });

    this.redis.on("error", (err) => {
      Debug.error({
        module: "HeartbeatManager",
        context: "constructor",
        message: `Redis error: ${err.message}`,
        code: "REDIS_ERROR",
      });
    });
  }

  /**
   * Start the heartbeat manager.
   * Seeds Redis with current agent states from Convex.
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      Debug.log({
        module: "HeartbeatManager",
        context: "start",
        message: "Already running, skipping start",
      });
      return;
    }

    this.isRunning = true;

    Debug.log({
      module: "HeartbeatManager",
      context: "start",
      message: "Starting heartbeat manager",
    });

    // Seed Redis from Convex
    await this.seedFromConvex();

    // Start background workers
    this.startStaleChecker();
    this.startSyncWorker();

    Debug.log({
      module: "HeartbeatManager",
      context: "start",
      message: "Heartbeat manager started successfully",
    });
  }

  /**
   * Stop the heartbeat manager gracefully.
   * Flushes pending updates to Convex before shutting down.
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    Debug.log({
      module: "HeartbeatManager",
      context: "stop",
      message: "Stopping heartbeat manager",
    });

    this.isRunning = false;

    // Stop intervals
    if (this.staleCheckInterval) {
      clearInterval(this.staleCheckInterval);
    }
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    // Flush pending updates
    await this.syncToConvex();

    // Disconnect Redis
    await this.redis.quit();

    Debug.log({
      module: "HeartbeatManager",
      context: "stop",
      message: "Heartbeat manager stopped",
    });
  }

  /**
   * Record a heartbeat from an agent.
   * Updates Redis timestamp and queues status change if needed.
   */
  async recordHeartbeat(agentId: Id<"agents">): Promise<void> {
    const now = Date.now();
    const key = this.getRedisKey(agentId);

    // Get current status
    const current = await this.redis.hgetall(key);
    const currentStatus = current.status as AgentStatus | undefined;

    Debug.log({
      module: "HeartbeatManager",
      context: "recordHeartbeat",
      message: `Heartbeat for ${agentId}: current status = ${currentStatus || "undefined"}`,
    });

    // Update heartbeat timestamp
    await this.redis.hset(key, {
      lastHeartbeat: now,
      status: "online",
    });

    // If agent was offline or unknown, queue status update
    if (currentStatus && currentStatus !== "online") {
      Debug.log({
        module: "HeartbeatManager",
        context: "recordHeartbeat",
        message: `Agent ${agentId} status changed: ${currentStatus} → online`,
      });

      this.queueStatusUpdate({
        id: agentId,
        status: "online",
        statusChangedAt: now,
        lastCheckinAt: now,
      });
    } else if (!currentStatus) {
      Debug.log({
        module: "HeartbeatManager",
        context: "recordHeartbeat",
        message: `Agent ${agentId} has no current status in Redis, not queuing update (will be seeded or is new)`,
      });
    }
  }

  /**
   * Get agent status from Redis.
   */
  async getAgentStatus(agentId: Id<"agents">): Promise<HeartbeatData | null> {
    const key = this.getRedisKey(agentId);
    const data = await this.redis.hgetall(key);

    if (!data.lastHeartbeat || !data.status) {
      return null;
    }

    return {
      lastHeartbeat: parseInt(data.lastHeartbeat, 10),
      status: data.status as AgentStatus,
    };
  }

  /**
   * Seed Redis with current agent states from Convex.
   */
  private async seedFromConvex(): Promise<void> {
    try {
      Debug.log({
        module: "HeartbeatManager",
        context: "seedFromConvex",
        message: "Seeding Redis with agent states from Convex",
      });

      const agents = await client.query(api.agents.crud_s.list, {
        secret: process.env.CONVEX_API_KEY!,
      });

      if (!agents || agents.length === 0) {
        Debug.log({
          module: "HeartbeatManager",
          context: "seedFromConvex",
          message: "No agents found in Convex",
        });
        return;
      }

      const pipeline = this.redis.pipeline();

      for (const agent of agents) {
        const key = this.getRedisKey(agent._id);
        const status = agent.status || "unknown";
        const lastHeartbeat = agent.lastCheckinAt || Date.now();

        pipeline.hset(key, {
          lastHeartbeat,
          status,
        });
      }

      await pipeline.exec();

      Debug.log({
        module: "HeartbeatManager",
        context: "seedFromConvex",
        message: `Seeded ${agents.length} agents to Redis`,
      });
    } catch (error) {
      Debug.error({
        module: "HeartbeatManager",
        context: "seedFromConvex",
        message: `Failed to seed from Convex: ${error}`,
        code: "SEED_ERROR",
      });
    }
  }

  /**
   * Start the stale checker background worker.
   * Checks for agents that haven't sent heartbeats in >3 minutes.
   */
  private startStaleChecker(): void {
    this.staleCheckInterval = setInterval(async () => {
      if (!this.isRunning) return;

      try {
        await this.checkStaleAgents();
      } catch (error) {
        Debug.error({
          module: "HeartbeatManager",
          context: "staleChecker",
          message: `Error checking stale agents: ${error}`,
          code: "STALE_CHECK_ERROR",
        });
      }
    }, this.STALE_CHECK_INTERVAL_MS);
  }

  /**
   * Start the sync worker background worker.
   * Syncs status changes to Convex in batches.
   */
  private startSyncWorker(): void {
    Debug.log({
      module: "HeartbeatManager",
      context: "startSyncWorker",
      message: `Starting sync worker (interval: ${this.SYNC_INTERVAL_MS}ms)`,
    });

    this.syncInterval = setInterval(async () => {
      if (!this.isRunning) return;

      try {
        await this.syncToConvex();
      } catch (error) {
        Debug.error({
          module: "HeartbeatManager",
          context: "syncWorker",
          message: `Error syncing to Convex: ${error}`,
          code: "SYNC_ERROR",
        });
      }
    }, this.SYNC_INTERVAL_MS);
  }

  /**
   * Check for stale agents and queue status updates.
   */
  private async checkStaleAgents(): Promise<void> {
    try {
      const now = Date.now();
      const keys = await this.redis.keys("agent:*");

      if (keys.length === 0) {
        return;
      }

      let staleCount = 0;

      for (const key of keys) {
        const data = await this.redis.hgetall(key);
        if (!data.lastHeartbeat || !data.status) continue;

        const lastHeartbeat = parseInt(data.lastHeartbeat, 10);
        const status = data.status as AgentStatus;
        const agentId = key.replace("agent:", "") as Id<"agents">;

        // Check if agent is stale (>3 min since last heartbeat)
        if (
          status === "online" &&
          now - lastHeartbeat > this.STALE_THRESHOLD_MS
        ) {
          Debug.log({
            module: "HeartbeatManager",
            context: "checkStaleAgents",
            message: `Agent ${agentId} is stale (${Math.floor((now - lastHeartbeat) / 1000)}s since last heartbeat)`,
          });

          // Update Redis status
          await this.redis.hset(key, "status", "offline");

          // Queue Convex update
          this.queueStatusUpdate({
            id: agentId,
            status: "offline",
            statusChangedAt: now,
          });

          staleCount++;
        }
      }

      if (staleCount > 0) {
        Debug.log({
          module: "HeartbeatManager",
          context: "checkStaleAgents",
          message: `Found ${staleCount} stale agents`,
        });
      }
    } catch (error) {
      Debug.error({
        module: "HeartbeatManager",
        context: "checkStaleAgents",
        message: `Error checking stale agents: ${error}`,
        code: "STALE_CHECK_ERROR",
      });
    }
  }

  /**
   * Sync queued status updates to Convex in batches.
   */
  private async syncToConvex(): Promise<void> {
    Debug.log({
      module: "HeartbeatManager",
      context: "syncToConvex",
      message: `Sync triggered. Queue size: ${this.statusUpdateQueue.length}`,
    });

    if (this.statusUpdateQueue.length === 0) {
      return;
    }

    // Take batch from queue
    const batch = this.statusUpdateQueue.splice(0, this.BATCH_SIZE);

    Debug.log({
      module: "HeartbeatManager",
      context: "syncToConvex",
      message: `Syncing ${batch.length} status updates to Convex`,
    });

    try {
      const result = await client.mutation(
        api.agents.internal.batchUpdateStatus,
        {
          secret: process.env.CONVEX_API_KEY!,
          updates: batch,
        }
      );

      Debug.log({
        module: "HeartbeatManager",
        context: "syncToConvex",
        message: `Successfully updated ${result.totalUpdated} agents (${result.totalFailed} failed)`,
      });

      // If there are failures, log them
      if (result.totalFailed > 0) {
        const failures = result.results.filter((r) => !r.success);
        Debug.error({
          module: "HeartbeatManager",
          context: "syncToConvex",
          message: `Failed to update ${failures.length} agents: ${JSON.stringify(failures)}`,
          code: "BATCH_UPDATE_PARTIAL_FAILURE",
        });
      }
    } catch (error) {
      Debug.error({
        module: "HeartbeatManager",
        context: "syncToConvex",
        message: `Failed to sync batch to Convex: ${error}`,
        code: "BATCH_UPDATE_ERROR",
      });

      // Re-queue failed updates
      this.statusUpdateQueue.unshift(...batch);
    }
  }

  /**
   * Queue a status update for batching.
   */
  private queueStatusUpdate(update: StatusUpdate): void {
    // Check if update already exists in queue for this agent
    const existingIndex = this.statusUpdateQueue.findIndex(
      (u) => u.id === update.id
    );

    if (existingIndex >= 0) {
      // Replace existing update with newer one
      this.statusUpdateQueue[existingIndex] = update;
      Debug.log({
        module: "HeartbeatManager",
        context: "queueStatusUpdate",
        message: `Updated existing queue entry for ${update.id} to ${update.status}`,
      });
    } else {
      // Add new update
      this.statusUpdateQueue.push(update);
      Debug.log({
        module: "HeartbeatManager",
        context: "queueStatusUpdate",
        message: `Queued new status update for ${update.id}: ${update.status} (queue size: ${this.statusUpdateQueue.length})`,
      });
    }

    // If queue is getting large, trigger immediate sync
    if (this.statusUpdateQueue.length >= this.BATCH_SIZE) {
      Debug.log({
        module: "HeartbeatManager",
        context: "queueStatusUpdate",
        message: `Queue reached batch size (${this.BATCH_SIZE}), triggering immediate sync`,
      });
      void this.syncToConvex();
    }
  }

  /**
   * Get Redis key for agent.
   */
  private getRedisKey(agentId: Id<"agents">): string {
    return `agent:${agentId}`;
  }
}

// Singleton instance
let heartbeatManager: HeartbeatManager | null = null;

export function getHeartbeatManager(): HeartbeatManager {
  if (!heartbeatManager) {
    heartbeatManager = new HeartbeatManager();
  }
  return heartbeatManager;
}

export async function startHeartbeatManager(): Promise<HeartbeatManager> {
  const manager = getHeartbeatManager();
  await manager.start();
  return manager;
}

export async function stopHeartbeatManager(): Promise<void> {
  if (heartbeatManager) {
    await heartbeatManager.stop();
  }
}
