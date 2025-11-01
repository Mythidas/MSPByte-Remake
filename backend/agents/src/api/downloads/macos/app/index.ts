import fastify, { FastifyInstance } from "fastify";
import path from "path";

const INSTALLERS_DIR = path.join(__dirname, "../../../../lib/installers");
const DMG_DIR = path.join(INSTALLERS_DIR, "dmg");

export default async function (fastify: FastifyInstance) {
  fastify.get("/", async (req) => {
    try {
      const dmgPath = path.join(DMG_DIR, `MSPAgent_0.1.14.dmg`);

      // Check if file exists
      try {
        await fs.access(dmgPath);
      } catch {
        return reply.code(404).send({
          error: "DMG not found",
          version,
          path: dmgPath,
        });
      }

      const stat = await fs.stat(dmgPath);
      const dmgStream = (await import("fs")).createReadStream(dmgPath);

      fastify.log.info(`Serving DMG: ${dmgPath} (${stat.size} bytes)`);

      reply
        .header("Content-Type", "application/x-apple-diskimage")
        .header(
          "Content-Disposition",
          `attachment; filename="MSPAgent_${version}.dmg"`
        )
        .header("Content-Length", stat.size)
        .send(dmgStream);
    } catch (err) {
      fastify.log.error("Error serving DMG:", err);
      reply.code(500).send({ error: "Failed to serve DMG file" });
    }
  });
}
