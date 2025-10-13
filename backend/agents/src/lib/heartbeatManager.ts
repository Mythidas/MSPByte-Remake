import Redis from "ioredis";
import Debug from "@workspace/shared/lib/Debug.js";
import { api } from "@workspace/database/convex/_generated/api.js";
import type { Id } from "@workspace/database/convex/_generated/dataModel.js";
import { client } from "@workspace/shared/lib/convex.js";

type AgentStatus = "online" | "offline" | "unknown";

interface HeartbeatData {
  lastHeartbeat: number;
  status: AgentStatus;
  guid?: string;
  hostname?: string;
  version?: string;
  ipAddress?: string;
  extAddress?: string;
  macAddress?: string;
}

interface AgentUpdate {
  id: Id<"agents">;
  status: AgentStatus;
  statusChangedAt: number;
  guid?: string;
  hostname?: string;
  version?: string;
  ipAddress?: string;
  extAddress?: string;
  macAddress?: string;
}

export class HeartbeatManager {
  private redis: Redis;
  private staleCheckInterval?: NodeJS.Timeout;
  private syncInterval?: NodeJS.Timeout;
  private readonly STALE_THRESHOLD_MS = 3 * 60 * 1000; // 3 minutes
  private readonly STALE_CHECK_INTERVAL_MS = 30 * 1000; // 30 seconds
  private readonly SYNC_INTERVAL_MS = 5 * 60 * 1000; // 10 minutes
  private readonly BATCH_SIZE = 50; // Max updates per batch
  private readonly PENDING_AGENTS_KEY = "heartbeat:pending_agents"; // Redis SET of agent IDs with pending updates
  private readonly UPDATE_KEY_PREFIX = "heartbeat:update:"; // Redis HASH key prefix for agent updates
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
   * Updates Redis timestamp and queues status/metadata changes if needed.
   */
  async recordHeartbeat(
    agentId: Id<"agents">,
    metadata: {
      guid?: string;
      hostname?: string;
      version?: string;
      ipAddress?: string;
      extAddress?: string;
      macAddress?: string;
    }
  ): Promise<void> {
    const now = Date.now();
    const key = this.getRedisKey(agentId);

    // Get current data from Redis
    const current = await this.redis.hgetall(key);
    const currentStatus = current.status as AgentStatus | "unknown";

    Debug.log({
      module: "HeartbeatManager",
      context: "recordHeartbeat",
      message: `Heartbeat for ${agentId}: current status = ${currentStatus}`,
    });

    // Build update data
    const redisUpdate: Record<string, string | number> = {
      lastHeartbeat: now,
      status: "online",
      ...metadata,
    };

    // Update Redis with heartbeat + metadata
    await this.redis.hset(key, redisUpdate);

    // Check if we need to queue updates to Convex
    let needsUpdate = false;
    const update: AgentUpdate = {
      id: agentId,
      status: "online",
      statusChangedAt: now,
    };

    // Check status change
    if (currentStatus && currentStatus !== "online") {
      Debug.log({
        module: "HeartbeatManager",
        context: "recordHeartbeat",
        message: `Agent ${agentId} status changed: ${currentStatus} → online`,
      });
      needsUpdate = true;
    }

    // Check metadata changes
    if (metadata.guid && metadata.guid !== current.guid) {
      Debug.log({
        module: "HeartbeatManager",
        context: "recordHeartbeat",
        message: `Agent ${agentId} GUID changed`,
      });
      update.guid = metadata.guid;
      needsUpdate = true;
    }

    if (metadata.hostname && metadata.hostname !== current.hostname) {
      Debug.log({
        module: "HeartbeatManager",
        context: "recordHeartbeat",
        message: `Agent ${agentId} hostname changed`,
      });
      update.hostname = metadata.hostname;
      needsUpdate = true;
    }

    if (metadata.version && metadata.version !== current.version) {
      Debug.log({
        module: "HeartbeatManager",
        context: "recordHeartbeat",
        message: `Agent ${agentId} version changed`,
      });
      update.version = metadata.version;
      needsUpdate = true;
    }

    if (metadata.ipAddress && metadata.ipAddress !== current.ipAddress) {
      Debug.log({
        module: "HeartbeatManager",
        context: "recordHeartbeat",
        message: `Agent ${agentId} IP address changed`,
      });
      update.ipAddress = metadata.ipAddress;
      needsUpdate = true;
    }

    if (metadata.extAddress && metadata.extAddress !== current.extAddress) {
      Debug.log({
        module: "HeartbeatManager",
        context: "recordHeartbeat",
        message: `Agent ${agentId} external address changed`,
      });
      update.extAddress = metadata.extAddress;
      needsUpdate = true;
    }

    if (metadata.macAddress && metadata.macAddress !== current.macAddress) {
      Debug.log({
        module: "HeartbeatManager",
        context: "recordHeartbeat",
        message: `Agent ${agentId} MAC address changed`,
      });
      update.macAddress = metadata.macAddress;
      needsUpdate = true;
    }

    // Queue update if anything changed
    if (needsUpdate) {
      await this.queueUpdate(update);
    } else if (!currentStatus) {
      Debug.log({
        module: "HeartbeatManager",
        context: "recordHeartbeat",
        message: `Agent ${agentId} has no current status in Redis, not queuing update (will be seeded or is new)`,
      });
    }
  }

  /**
   * Get agent data from Redis, fetching from Convex if not cached.
   * This eliminates per-heartbeat Convex queries.
   */
  async getOrFetchAgent(agentId: Id<"agents">): Promise<HeartbeatData | null> {
    const key = this.getRedisKey(agentId);
    const data = await this.redis.hgetall(key);

    // If we have data in Redis, return it
    if (data.lastHeartbeat && data.status) {
      return {
        lastHeartbeat: parseInt(data.lastHeartbeat, 10),
        status: data.status as AgentStatus,
        guid: data.guid,
        hostname: data.hostname,
        version: data.version,
        ipAddress: data.ipAddress,
        extAddress: data.extAddress,
        macAddress: data.macAddress,
      };
    }

    // Cache miss - fetch from Convex and seed Redis
    Debug.log({
      module: "HeartbeatManager",
      context: "getOrFetchAgent",
      message: `Cache miss for ${agentId}, fetching from Convex`,
    });

    try {
      const agent = await client.query(api.agents.crud_s.get, {
        id: agentId,
        secret: process.env.CONVEX_API_KEY!,
      });

      if (!agent) {
        Debug.log({
          module: "HeartbeatManager",
          context: "getOrFetchAgent",
          message: `Agent ${agentId} not found in Convex`,
        });
        return null;
      }

      // Seed Redis with agent data
      const redisData: Record<string, string | number> = {
        lastHeartbeat: agent.statusChangedAt || Date.now(),
        status: agent.status || "unknown",
      };

      if (agent.guid) redisData.guid = agent.guid;
      if (agent.hostname) redisData.hostname = agent.hostname;
      if (agent.version) redisData.version = agent.version;
      if (agent.ipAddress) redisData.ipAddress = agent.ipAddress;
      if (agent.extAddress) redisData.extAddress = agent.extAddress;
      if (agent.macAddress) redisData.macAddress = agent.macAddress;

      await this.redis.hset(key, redisData);

      Debug.log({
        module: "HeartbeatManager",
        context: "getOrFetchAgent",
        message: `Cached agent ${agentId} in Redis`,
      });

      return {
        lastHeartbeat: agent.statusChangedAt || Date.now(),
        status: (agent.status as AgentStatus) || "unknown",
        guid: agent.guid,
        hostname: agent.hostname,
        version: agent.version,
        ipAddress: agent.ipAddress,
        extAddress: agent.extAddress,
        macAddress: agent.macAddress,
      };
    } catch (error) {
      Debug.error({
        module: "HeartbeatManager",
        context: "getOrFetchAgent",
        message: `Failed to fetch agent ${agentId} from Convex: ${error}`,
        code: "FETCH_AGENT_ERROR",
      });
      return null;
    }
  }

  /**
   * Get agent status from Redis (legacy method for backward compatibility).
   */
  async getAgentStatus(agentId: Id<"agents">): Promise<HeartbeatData | null> {
    return this.getOrFetchAgent(agentId);
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
        const lastHeartbeat = agent.statusChangedAt || Date.now();

        // Store full agent metadata in Redis
        const redisData: Record<string, string | number> = {
          lastHeartbeat,
          status,
        };

        if (agent.guid) redisData.guid = agent.guid;
        if (agent.hostname) redisData.hostname = agent.hostname;
        if (agent.version) redisData.version = agent.version;
        if (agent.ipAddress) redisData.ipAddress = agent.ipAddress;
        if (agent.extAddress) redisData.extAddress = agent.extAddress;
        if (agent.macAddress) redisData.macAddress = agent.macAddress;

        pipeline.hset(key, redisData);
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
      message: `Starting sync worker, next job at ${new Date(Date.now() + this.SYNC_INTERVAL_MS).toLocaleString()} (interval: ${this.SYNC_INTERVAL_MS}ms)`,
    });

    this.syncInterval = setInterval(async () => {
      if (!this.isRunning) return;

      try {
        await this.syncToConvex();

        Debug.log({
          module: "HeartbeatManager",
          context: "startSyncWorker",
          message: `Next job at ${new Date(Date.now() + this.SYNC_INTERVAL_MS).toLocaleString()} (interval: ${this.SYNC_INTERVAL_MS}ms)`,
        });
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
          await this.queueUpdate({
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
   * Sync queued agent updates to Convex in batches.
   * Uses SET+HASH structure to ensure only latest update per agent is processed.
   */
  private async syncToConvex(): Promise<void> {
    try {
      const queueSize = await this.redis.scard(this.PENDING_AGENTS_KEY);

      Debug.log({
        module: "HeartbeatManager",
        context: "syncToConvex",
        message: `Sync triggered. Queue size: ${queueSize}`,
      });

      if (queueSize === 0) {
        return;
      }

      // Get batch of agent IDs from the pending set (SPOP removes and returns)
      const agentIds = await this.redis.spop(
        this.PENDING_AGENTS_KEY,
        this.BATCH_SIZE
      );

      if (!agentIds || agentIds.length === 0) {
        return;
      }

      // Fetch all updates for these agents
      const pipeline = this.redis.pipeline();
      for (const agentId of agentIds) {
        pipeline.get(this.getUpdateKey(agentId as Id<"agents">));
      }
      const results = await pipeline.exec();

      // Parse updates
      const batch: AgentUpdate[] = [];
      const updateKeys: string[] = [];

      for (let i = 0; i < agentIds.length; i++) {
        const agentId = agentIds[i] as Id<"agents">;
        const result = results?.[i];

        if (result && result[1]) {
          try {
            const update = JSON.parse(result[1] as string);
            batch.push(update);
            updateKeys.push(this.getUpdateKey(agentId));
          } catch (error) {
            Debug.error({
              module: "HeartbeatManager",
              context: "syncToConvex",
              message: `Failed to parse update for ${agentId}: ${error}`,
              code: "PARSE_ERROR",
            });
          }
        }
      }

      if (batch.length === 0) {
        return;
      }

      const example = batch[0];
      Debug.log({
        module: "HeartbeatManager",
        context: "syncToConvex",
        message: `Syncing ${batch.length} agent updates to Convex (Ex. ID: ${example.id}, Status: ${example.status}, ipAddress: ${example.ipAddress}, guid: ${example.guid})`,
      });

      const result = await client.mutation(api.agents.internal.batchUpdate, {
        secret: process.env.CONVEX_API_KEY!,
        updates: batch,
      });

      Debug.log({
        module: "HeartbeatManager",
        context: "syncToConvex",
        message: `Successfully updated ${result.totalUpdated} agents (${result.totalFailed} failed)`,
      });

      // Clean up processed updates
      if (updateKeys.length > 0) {
        await this.redis.del(...updateKeys);
      }

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
    }
  }

  /**
   * Queue an agent update for batching.
   * Uses Redis SET+HASH for automatic deduplication - only the latest update per agent is kept.
   */
  private async queueUpdate(update: AgentUpdate): Promise<void> {
    try {
      // Add agent ID to pending set (automatically handles deduplication)
      await this.redis.sadd(this.PENDING_AGENTS_KEY, update.id);

      // Store the update data (overwrites any existing update for this agent)
      const updateKey = this.getUpdateKey(update.id);
      const updateJson = JSON.stringify(update);
      await this.redis.set(updateKey, updateJson);

      const queueSize = await this.redis.scard(this.PENDING_AGENTS_KEY);

      Debug.log({
        module: "HeartbeatManager",
        context: "queueUpdate",
        message: `Queued new update for ${update.id}: ${update.status} (queue size: ${queueSize})`,
      });

      // If queue is getting large, trigger immediate sync
      if (queueSize >= this.BATCH_SIZE) {
        Debug.log({
          module: "HeartbeatManager",
          context: "queueUpdate",
          message: `Queue reached batch size (${this.BATCH_SIZE}), triggering immediate sync`,
        });
        void this.syncToConvex();
      }
    } catch (error) {
      Debug.error({
        module: "HeartbeatManager",
        context: "queueUpdate",
        message: `Failed to queue update: ${error}`,
        code: "QUEUE_UPDATE_ERROR",
      });
    }
  }

  /**
   * Get Redis key for agent heartbeat data.
   */
  private getRedisKey(agentId: Id<"agents">): string {
    return `agent:${agentId}`;
  }

  /**
   * Get Redis key for agent update.
   */
  private getUpdateKey(agentId: Id<"agents">): string {
    return `${this.UPDATE_KEY_PREFIX}${agentId}`;
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
    heartbeatManager = null;
  }
}
