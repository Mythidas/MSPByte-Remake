import dotenv from "dotenv";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import Fastify from "fastify";
import cors from "@fastify/cors";
import autoload from "@fastify/autoload";

// Compute __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, "../../../.env.local") });

// Initialize Fastify server
const fastify = Fastify({ logger: false });

// Register CORS for agent communication
await fastify.register(cors, {
  origin: true, // Allow all origins for agents
  credentials: true,
});
await fastify.register(autoload, {
  dir: join(import.meta.dirname, "api"),
  options: {},
});

await fastify.listen({ port: 3001, host: "0.0.0.0" });

process.on("SIGTERM", () => fastify.close());
process.on("SIGINT", () => fastify.close());
