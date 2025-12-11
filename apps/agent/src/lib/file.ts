import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import Debug from "@workspace/shared/lib/Debug.ts";
import { APIResponse } from "@workspace/shared/types/api.ts";

export async function takeScreenshot(): Promise<APIResponse<string>> {
  try {
    const result = await invoke<string>("take_screenshot");

    return {
      data: result,
    };
  } catch (err) {
    return Debug.error({
      module: "File",
      context: "takeScreenshot",
      message: `Failed to take screenshot: ${err}`,
    });
  }
}

export async function chooseImageDialog(): Promise<APIResponse<string>> {
  try {
    const file = await open({
      multiple: false,
      directory: false,
      filters: [
        {
          name: "Image",
          extensions: ["png", "jpeg", "jpg"],
        },
      ],
    });

    if (!file) {
      throw "Failed to open file. Please try again.";
    }

    return {
      data: file,
    };
  } catch (err) {
    return Debug.error({
      module: "File",
      context: "chooseImageDialog",
      message: String(err),
    });
  }
}

export async function logToFile(
  level: "INFO" | "WARN" | "ERROR",
  message: string,
): Promise<APIResponse<undefined>> {
  try {
    await invoke("log_to_file", {
      level,
      message,
    });

    return {
      data: undefined,
    };
  } catch (err) {
    // Don't use Debug.error here to avoid infinite loop
    console.error(`Failed to log to file: ${err}`);
    return {
      error: {
        module: "File",
        context: "logToFile",

        message: `Failed to write to log file: ${err}`,
        time: new Date().toISOString(),
      },
    };
  }
}

export async function readFileText(path: string): Promise<APIResponse<string>> {
  try {
    const content = await invoke<string>("read_file_text", {
      path: path,
    });

    return {
      data: content,
    };
  } catch (err) {
    return Debug.error({
      module: "File",
      context: "readFileBase64",
      message: `Failed to read file: ${err}`,
    });
  }
}

export async function readFileBase64(
  path: string,
): Promise<APIResponse<string>> {
  try {
    const content = await invoke<string>("read_file_base64", {
      path: path,
    });

    return {
      data: content,
    };
  } catch (err) {
    return Debug.error({
      module: "File",
      context: "readFileBase64",
      message: `Failed to read file: ${err}`,
    });
  }
}

export async function readFileBinary(
  path: string,
): Promise<APIResponse<number[]>> {
  try {
    const content = await invoke<number[]>("read_file_binary", {
      path,
    });

    return {
      data: content,
    };
  } catch (err) {
    return Debug.error({
      module: "File",
      context: "readFileBinary",
      message: `Failed to read file: ${err}`,
    });
  }
}
