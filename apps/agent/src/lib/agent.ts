import { invoke } from "@tauri-apps/api/core";
import Debug from "@workspace/shared/lib/Debug.ts";
import { APIResponse } from "@workspace/shared/types/api.ts";

export type AgentSettings = {
  site_id: string;
  api_host: string;
  installed_at: string;

  guid?: string;
  device_id?: string;
  hostname?: string;
  registered_at?: string;
};

export async function getSettings(): Promise<APIResponse<AgentSettings>> {
  try {
    const content = await invoke<AgentSettings>("get_settings_info");
    if (!content) throw `No file found`;

    return {
      data: content,
    };
  } catch (err) {
    return Debug.error({
      module: "Agent",
      context: "getSettings",
      message: `Failed to get agent settings: ${err}`,
      code: "SYSTEM_ERROR",
    });
  }
}
