import Redis from "ioredis";
import { Logger } from "./logger.js";

/**
 * Redis connection manager for pipeline infrastructure
 * Used for:
 * - BullMQ job queue backing
 * - Distributed locks for sync coordination
 * - Optional caching layer
 */
class RedisManager {
  private client: Redis | null = null;
  private isConnected = false;

  /**
   * Get or create Redis client
   */
  getClient(): Redis {
    if (!this.client) {
      const redisHost = process.env.REDIS_HOST;
      const redisPort = process.env.REDIS_PORT;
      if (!redisHost || !redisPort) {
        throw new Error(
          "REDIS_HOST or REDIS_PORT environment variable is not set",
        );
      }

      this.client = new Redis(`${redisHost}:${redisPort}`, {
        maxRetriesPerRequest: null,
        retryStrategy: (times: number) => {
          const delay = Math.min(times * 50, 2000);
          Logger.log({
            module: "Redis",
            context: "getClient",
            message: `Redis connection retry attempt ${times}`,
            level: "warn",
          });
          return delay;
        },
        reconnectOnError: (err: Error) => {
          Logger.log({
            module: "Redis",
            context: "getClient",
            message: `Redis reconnect on error: ${err.message}`,
            level: "error",
          });
          return true;
        },
      });

      // Connection event handlers
      this.client.on("connect", () => {
        this.isConnected = true;
        Logger.log({
          module: "Redis",
          context: "getClient",
          message: "Redis connected successfully",
          level: "info",
        });
      });

      this.client.on("error", (err: Error) => {
        Logger.log({
          module: "Redis",
          context: "getClient",
          message: `Redis error: ${err.message}`,
          level: "error",
        });
      });

      this.client.on("close", () => {
        this.isConnected = false;
        Logger.log({
          module: "Redis",
          context: "getClient",
          message: "Redis connection closed",
          level: "warn",
        });
      });
    }

    return this.client;
  }

  /**
   * Check if Redis is connected and ready
   */
  isReady(): boolean {
    return this.isConnected && this.client?.status === "ready";
  }

  /**
   * Gracefully disconnect from Redis
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
      this.isConnected = false;
      Logger.log({
        module: "Redis",
        context: "disconnect",
        message: "Redis disconnected",
        level: "info",
      });
    }
  }

  /**
   * Get Redis health status
   */
  async healthCheck(): Promise<{ status: string; latency?: number }> {
    if (!this.client || !this.isConnected) {
      return { status: "disconnected" };
    }

    try {
      const start = Date.now();
      await this.client.ping();
      const latency = Date.now() - start;
      return { status: "healthy", latency };
    } catch (error) {
      return { status: "unhealthy" };
    }
  }
}

// Singleton instance
export const redis = new RedisManager();
