import { writeHeapSnapshot } from "v8";
import { FastifyInstance } from "fastify";

const startTime = Date.now();

export default async function (fastify: FastifyInstance) {
  // Memory usage endpoint
  fastify.get("/memory", async () => {
    const usage = process.memoryUsage();
    return {
      rss: `${Math.round(usage.rss / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(usage.heapTotal / 1024 / 1024)}MB`,
      heapUsed: `${Math.round(usage.heapUsed / 1024 / 1024)}MB`,
      external: `${Math.round(usage.external / 1024 / 1024)}MB`,
      arrayBuffers: `${Math.round(usage.arrayBuffers / 1024 / 1024)}MB`,
      raw: {
        rss: usage.rss,
        heapTotal: usage.heapTotal,
        heapUsed: usage.heapUsed,
        external: usage.external,
        arrayBuffers: usage.arrayBuffers,
      },
    };
  });

  // Heap snapshot endpoint
  fastify.get("/heap-snapshot", async () => {
    try {
      const filename = writeHeapSnapshot();
      return {
        success: true,
        filename,
        message:
          "Heap snapshot created. Download from Railway volume or use Railway CLI to fetch.",
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  });

  // Runtime stats endpoint
  fastify.get("/stats", async () => {
    const uptime = process.uptime();
    const usage = process.memoryUsage();

    return {
      uptime: {
        seconds: Math.round(uptime),
        formatted: formatUptime(uptime),
      },
      memory: {
        rss: `${Math.round(usage.rss / 1024 / 1024)}MB`,
        heapUsed: `${Math.round(usage.heapUsed / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(usage.heapTotal / 1024 / 1024)}MB`,
      },
      process: {
        pid: process.pid,
        version: process.version,
        platform: process.platform,
        arch: process.arch,
      },
      startTime: new Date(startTime).toISOString(),
    };
  });

  // Force garbage collection (only works if Node is started with --expose-gc)
  fastify.post("/gc", async () => {
    if (global.gc) {
      global.gc();
      return {
        success: true,
        message: "Garbage collection triggered",
      };
    } else {
      return {
        success: false,
        message:
          "Garbage collection not available. Start Node with --expose-gc",
      };
    }
  });
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

  return parts.join(" ");
}
