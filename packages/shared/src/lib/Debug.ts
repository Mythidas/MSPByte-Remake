import { APIError } from "@workspace/shared/types/api";

type APIResponse<T> =
  | {
      data: T;
      error?: undefined;
      meta?: Record<string, any> | undefined;
    }
  | {
      data?: undefined;
      error: Omit<APIError, "time">;
      meta?: Record<string, any>;
    };

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

  static response(body: APIResponse<any>, status: number) {
    const time = new Date();

    if (status !== 200 && body.error) {
      console.error(
        `[${time.toLocaleTimeString()}][${body.error.module}][${body.error.context}] ${body.error.message} | ${status}`
      );
    }

    return Response.json(body, { status });
  }
}
