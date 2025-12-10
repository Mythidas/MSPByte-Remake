import Debug from "@workspace/shared/lib/Debug";
import { natsClient } from "@workspace/pipeline/helpers/nats";
import { api } from "@workspace/database/convex/_generated/api.js";
import type { Doc } from "@workspace/database/convex/_generated/dataModel.js";
import { APIResponse } from "@workspace/shared/types/api";

export abstract class BaseLinker {
  constructor() {}

  async start(): Promise<void> {}
}
