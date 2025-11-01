import { FastifyInstance } from "fastify";
import path from "path";
import fs from "fs/promises";
import { createReadStream } from "fs";

const INSTALLERS_DIR = path.join(__dirname, "../../../../lib/installers");
const SCRIPTS_DIR = path.join(INSTALLERS_DIR, "scripts");

export default async function (fastify: FastifyInstance) {
  fastify.get("/", async (req, reply) => {
    try {
      const scriptPath = path.join(SCRIPTS_DIR, "install_mspagent_mac.sh");

      // Check if file exists
      try {
        await fs.access(scriptPath);
      } catch {
        return reply.code(404).send({
          error: "Install script not found",
          path: scriptPath,
        });
      }

      const stat = await fs.stat(scriptPath);
      const scriptStream = createReadStream(scriptPath);

      fastify.log.info(`Serving install script: ${scriptPath} (${stat.size} bytes)`);

      reply
        .header("Content-Type", "text/x-shellscript")
        .header(
          "Content-Disposition",
          'inline; filename="install_mspagent_mac.sh"'
        )
        .header("Content-Length", stat.size)
        .header("Cache-Control", "public, max-age=300")
        .send(scriptStream);
    } catch (err) {
      fastify.log.error("Error serving install script:", err);
      reply.code(500).send({ error: "Failed to serve install script" });
    }
  });
}
