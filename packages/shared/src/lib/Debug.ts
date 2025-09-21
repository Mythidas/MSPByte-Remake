import { APIError } from "@workspace/shared/types/api";

export default class Debug {
  static log(info: Omit<APIError, "time" | "code">) {
    const time = new Date();
    console.info(
      `[${time.toLocaleTimeString()}][${info.module}][${info.context}] ${info.message}`
    );
  }

  static error(error: Omit<APIError, "time">) {
    const time = new Date();
    console.error(
      `[${time.toLocaleTimeString()}][${error.module}][${error.context}] ${error.message} | ${error.code}`
    );
    return {
      error: {
        ...error,
        time: time.toISOString(),
      },
    };
  }
}
