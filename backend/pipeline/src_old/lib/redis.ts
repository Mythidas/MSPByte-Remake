import IORedis from 'ioredis';
import Logger from './logger.js';

class RedisManager {
  private static connection: IORedis | null = null;
  private static isConnecting = false;

  static async getConnection(): Promise<IORedis> {
    if (this.connection && this.connection.status === 'ready') {
      return this.connection;
    }

    if (this.isConnecting) {
      // Wait for existing connection attempt
      await new Promise(resolve => setTimeout(resolve, 100));
      return this.getConnection();
    }

    this.isConnecting = true;

    try {
      const config = {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD || undefined,
        maxRetriesPerRequest: null, // Required for BullMQ
        retryStrategy: (times: number) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
      };

      this.connection = new IORedis(config);

      this.connection.on('connect', () => {
        Logger.log({
          module: 'RedisManager',
          context: 'connection',
          message: 'Connected to Redis',
        });
      });

      this.connection.on('error', (error) => {
        Logger.log({
          module: 'RedisManager',
          context: 'connection',
          message: `Redis error: ${error.message}`,
          level: 'error',
          error,
        });
      });

      this.connection.on('close', () => {
        Logger.log({
          module: 'RedisManager',
          context: 'connection',
          message: 'Redis connection closed',
        });
      });

      // Wait for connection
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Redis connection timeout'));
        }, 5000);

        this.connection!.once('ready', () => {
          clearTimeout(timeout);
          resolve();
        });

        this.connection!.once('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });

      this.isConnecting = false;
      return this.connection;
    } catch (error) {
      this.isConnecting = false;
      this.connection = null;
      throw error;
    }
  }

  static async disconnect(): Promise<void> {
    if (this.connection) {
      await this.connection.quit();
      this.connection = null;
    }
  }

  static async ping(): Promise<boolean> {
    try {
      const conn = await this.getConnection();
      const result = await conn.ping();
      return result === 'PONG';
    } catch (error) {
      return false;
    }
  }

  static async healthCheck(): Promise<{
    healthy: boolean;
    latency?: number;
    error?: string;
  }> {
    try {
      const start = Date.now();
      const pong = await this.ping();
      const latency = Date.now() - start;

      return {
        healthy: pong,
        latency,
      };
    } catch (error) {
      return {
        healthy: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

export default RedisManager;
