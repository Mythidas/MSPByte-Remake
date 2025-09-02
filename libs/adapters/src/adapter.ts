import { APIResponse } from "@workspace/shared/types/api.js";
import { Tables } from "@workspace/shared/types/database/index.js";

export interface IAdapter {
  start(): Promise<void>;
  stop(): Promise<void>;
  connected(): Promise<boolean>;
  processJob(job: Tables<"scheduled_jobs">): Promise<APIResponse<undefined>>;
}
