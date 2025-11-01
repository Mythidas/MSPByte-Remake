import { FastifyInstance } from "fastify";
import path, { dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const INSTALLERS_DIR = path.join(__dirname, "../../../../lib/installers/dmg");

export default async function(fastify: FastifyInstance) {
    fastify.get("/", async (req, reply) => {
        const fileName = "MSPAgent_0.1.14.dmg";

        try {
            // `sendFile` handles streaming and most headers automatically
            return reply
                .header("Content-Type", "text/x-apple-diskimage")
                .header("Content-Disposition", `attachment; filename="${fileName}"`)
                .sendFile(fileName, INSTALLERS_DIR);
        } catch (err) {
            fastify.log.error(err, "Failed to serve uninstall script");
            return reply.code(500).send({ error: "Failed to serve uninstall script" });
        }
    });
}
