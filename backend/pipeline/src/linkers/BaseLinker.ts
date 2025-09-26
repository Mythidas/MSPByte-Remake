import Debug from "@workspace/shared/lib/Debug";
import { natsClient } from "@workspace/pipeline/helpers/nats";
import { insertRows } from "@workspace/shared/lib/db/orm";
import { APIResponse } from "@workspace/shared/types/api";
import { Tables } from "@workspace/shared/types/database";

export abstract class BaseLinker {
  constructor() {}

  async start(): Promise<void> {}
}
