import { invoke } from "@tauri-apps/api/core";
import Debug from "@workspace/shared/lib/Debug.ts";
import { APIResponse } from "@workspace/shared/types/api.ts";

export async function getRegistryValue(
  path: string,
  key: string,
): Promise<APIResponse<string>> {
  try {
    const result = await invoke<string>("read_registry_value", {
      path,
      key,
    });
    if (!result) throw `Invalid key path`;

    return {
      data: result,
    };
  } catch (err) {
    return Debug.error({
      module: "Registry",
      context: "getRegistryKey",
      message: `Failed to get registry value: ${err}`,
    });
  }
}
