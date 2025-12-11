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

export type SystemInfo = {
  hostname: string;
  ip_address?: string;
  ext_address?: string;
  mac_address?: string;
  guid?: string;
  version?: string;
  username?: string;
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
    });
  }
}

export async function getSystemInfo(): Promise<APIResponse<SystemInfo>> {
  try {
    const content = await invoke<SystemInfo>("get_os_info");
    if (!content) throw "No system info found";

    return {
      data: content,
    };
  } catch (err) {
    return Debug.error({
      module: "Agent",
      context: "getSystemInfo",
      message: `Failed to get system info`,
    });
  }
}

export async function getRmmId(): Promise<APIResponse<string>> {
  try {
    const content = await invoke<string>("get_rmm_id");
    if (!content) throw "Failed to get Windows key";

    return { data: content };
  } catch {
    return Debug.error({
      module: "Agent",
      context: "getRmmId",
      message: "Failed to get RMM ID",
    });
  }
}
