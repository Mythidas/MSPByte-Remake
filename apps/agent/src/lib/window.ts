import { invoke } from "@tauri-apps/api/core";

export async function hideWindow(label: string) {
  await invoke("hide_window", { label });
}

export async function showWindow(label: string) {
  await invoke("show_window", { label });
}
