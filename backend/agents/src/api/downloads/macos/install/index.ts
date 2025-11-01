import { FastifyInstance } from "fastify";
import path, { dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "../../../../../../../");
const INSTALLERS_DIR = path.join(PROJECT_ROOT, "assets/installers/scripts");

export default async function(fastify: FastifyInstance) {
    fastify.get("/", async (req, reply) => {
        const fileName = "install_mspagent_mac.sh";

        try {
            // `sendFile` handles streaming and most headers automatically
            return reply
                .header("Content-Type", "text/x-shellscript")
                .header("Content-Disposition", `inline; filename="${fileName}"`)
                .sendFile(fileName, INSTALLERS_DIR);
        } catch (err) {
            fastify.log.error(err, "Failed to serve uninstall script");
            return reply.code(500).send({ error: "Failed to serve uninstall script" });
        }
    });
}
