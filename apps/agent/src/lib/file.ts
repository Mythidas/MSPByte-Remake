import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import Debug from "@workspace/shared/lib/Debug.ts";
import { APIResponse } from "@workspace/shared/types/api.ts";

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
      code: "DIALOG_ERROR",
    });
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
      code: "FILE_ERROR",
    });
  }
}

export async function readFileBase64(
  path: string
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
      code: "FILE_ERROR",
    });
  }
}
