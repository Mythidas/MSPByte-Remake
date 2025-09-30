import { invoke } from "@tauri-apps/api/core";

export async function hideWindow(label: string) {
  await invoke("hide_window", { label });
}
