import { APIError } from "../types/api.js";

export default class Debug {
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
