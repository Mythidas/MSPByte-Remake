import { FastifyInstance } from "fastify";
import path from "path";
import fs from "fs/promises";
import { createReadStream } from "fs";

const INSTALLERS_DIR = path.join(__dirname, "../../../../lib/installers");
const DMG_DIR = path.join(INSTALLERS_DIR, "dmg");
const APP_VERSION = "0.1.14";

export default async function (fastify: FastifyInstance) {
  fastify.get("/", async (req, reply) => {
    try {
      const dmgPath = path.join(DMG_DIR, `MSPAgent_${APP_VERSION}.dmg`);

      // Check if file exists
      try {
        await fs.access(dmgPath);
      } catch {
        return reply.code(404).send({
          error: "DMG not found",
          version: APP_VERSION,
          path: dmgPath,
        });
      }

      const stat = await fs.stat(dmgPath);
      const dmgStream = createReadStream(dmgPath);

      fastify.log.info(`Serving DMG: ${dmgPath} (${stat.size} bytes)`);

      reply
        .header("Content-Type", "application/x-apple-diskimage")
        .header(
          "Content-Disposition",
          `attachment; filename="MSPAgent_${APP_VERSION}.dmg"`
        )
        .header("Content-Length", stat.size)
        .header("Cache-Control", "public, max-age=3600")
        .send(dmgStream);
    } catch (err) {
      fastify.log.error("Error serving DMG:", err);
      reply.code(500).send({ error: "Failed to serve DMG file" });
    }
  });
}
