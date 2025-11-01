import dotenv from "dotenv";
import path, { dirname, join } from "path";
import { fileURLToPath } from "url";
import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import autoload from "@fastify/autoload";
import fastifyStatic from "@fastify/static";
import { startHeartbeatManager, stopHeartbeatManager } from "./lib/heartbeatManager.js";
import Debug from "@workspace/shared/lib/Debug.js";

// Compute __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, "../../../.env") });

// Initialize Heartbeat Manager
Debug.log({
    module: "app",
    context: "startup",
    message: "Initializing heartbeat manager...",
});

await startHeartbeatManager();

Debug.log({
    module: "app",
    context: "startup",
    message: "Heartbeat manager initialized successfully",
});

// Initialize Fastify server
const fastify = Fastify({ logger: false });

// Register CORS for agent communication
await fastify.register(cors, {
    origin: true, // Allow all origins for agents
    credentials: true,
});

// Register multipart for file uploads
await fastify.register(multipart, {
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB max file size
    },
});

await fastify.register(autoload, {
    dir: join(__dirname, "api"),
    options: {},
});

const PROJECT_ROOT = path.resolve(__dirname, "../../../../");
await fastify.register(fastifyStatic, {
    root: path.join(PROJECT_ROOT, "backend/agents/assets/installers/scripts"),
    prefix: "/installers/", // optional
    decorateReply: true, // <-- this enables reply.sendFile()
});

const port = process.env.PORT || 3001;
await fastify.listen({ port: port as number, host: "0.0.0.0" });

Debug.log({
    module: "app",
    context: "startup",
    message: `Server listening on port ${port}`,
});

// Graceful shutdown handlers
async function shutdown(signal: string) {
    Debug.log({
        module: "app",
        context: "shutdown",
        message: `Received ${signal}, shutting down gracefully...`,
    });

    // Stop heartbeat manager (flushes pending updates)
    await stopHeartbeatManager();

    // Close Fastify server
    await fastify.close();

    Debug.log({
        module: "app",
        context: "shutdown",
        message: "Shutdown complete",
    });

    process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
