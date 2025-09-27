import {
  deleteRows,
  getRow,
  insertRows,
  upsertRows,
} from "@workspace/shared/lib/db/orm";
import Debug from "@workspace/shared/lib/Debug";
import Encryption from "@workspace/shared/lib/Encryption";
import { FastifyInstance } from "fastify";

type ReqBody = {
  secret?: string;
  hostname?: string;
  version?: string;
  guid?: string;
};

export default async function (fastify: FastifyInstance) {
  fastify.post("/", async (req) => {
    const { secret, hostname, version, guid } = req.body as ReqBody;

    if (!secret || !hostname || !version) {
      return Debug.response(
        {
          error: {
            module: "v1.0/register",
            context: "POST",
            message:
              "Secret, Hostname and Version are required for registration",
            code: "400",
          },
        },
        400
      );
    }

    const secretHash = Encryption.sha256(secret);
    const { data: site, error: siteError } = await getRow(
      "site_agent_secrets",
      {
        filters: [
          ["secret_key_hash", "eq", secretHash],
          ["active", "is", true],
        ],
      }
    );
    if (siteError) {
      return Debug.response(
        {
          error: {
            module: "v1.0/register",
            context: "POST",
            message: "Failed to find valid site or invalid secret",
            code: "400",
          },
        },
        404
      );
    }

    const result = await upsertRows("agents", {
      rows: [
        {
          tenant_id: site.tenant_id,
          site_id: site.site_id,

          // TODO: Make GUID as solid as possible to avoid duplicate devices
          guid:
            guid ||
            Encryption.sha256(
              JSON.stringify({ hostname, siteID: site.site_id })
            ),
          hostname: hostname,
          ip_address: "",
          ext_address: "",
          online: true,
          version: version,
        },
      ],
      onConflict: ["guid"],
    });

    if (result.error) {
      return Debug.response(
        {
          error: {
            module: "v1.0/register",
            context: "POST",
            message: "Failed to create agent",
            code: "500",
          },
        },
        500
      );
    }

    const agent = result.data[0];
    const key = Encryption.genKey();
    const hash = Encryption.sha256(key);
    const keyResult = await insertRows("agent_keys", {
      rows: [
        {
          tenant_id: site.tenant_id,
          site_id: site.site_id,
          agent_id: agent.id,
          key_hash: hash,
          active: true,
        },
      ],
    });

    if (keyResult.error) {
      await deleteRows("agents", {
        filters: [["id", "eq", agent.id]],
      });
      return Debug.response(
        {
          error: {
            module: "v1.0/register",
            context: "POST",
            message: "Failed to create agent encryption",
            code: "500",
          },
        },
        500
      );
    }

    return Debug.response(
      {
        data: key,
      },
      200
    );
  });
}
