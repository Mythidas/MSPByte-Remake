import { TablesInsert } from "../types/database/schema.js";
import { createClient } from "./db/client.js";
import Debug from "./Debug.js";
import { APIResponse } from "../types/api.js";

export default class APIClient {
  static async fetch<T = any>(
    input: string,
    init: RequestInit,
    module: string = "Fetch"
  ): Promise<APIResponse<T>> {
    const start = Date.now();
    const log: TablesInsert<"api_logs"> = {
      method: init?.method || "GET",
      url: input,
      headers: (init?.headers || {}) as Record<string, string>,
      body: typeof init?.body === "string" ? init.body : undefined,
    };

    try {
      const response = await fetch(input, init);
      const duration = Date.now() - start;

      const responseText = await response.text();

      log.status_code = response.status;
      log.response_headers = Object.fromEntries(response.headers.entries());
      log.response_body = responseText;
      log.duration_ms = duration;

      await this.logApiCall(log);

      if (!response.ok) {
        return Debug.error({
          module: module,
          context: "APIClient",
          message: `HTTP ${response.status}: ${responseText}`,
          code: `HTTP_${response.status}`,
        });
      }

      const contentType = response.headers.get("content-type");
      const data = contentType?.includes("application/json")
        ? JSON.parse(responseText)
        : responseText;

      return { data, meta: response };
    } catch (err) {
      const duration = Date.now() - start;
      const error = err instanceof Error ? err : new Error(String(err));

      log.duration_ms = duration;
      log.error_code = "NETWORK_ERROR";

      this.logApiCall(log);

      return Debug.error({
        module: module,
        context: "APIClient",
        message: `Network Error: ${error.message}`,
        code: "NETWORK_ERROR",
      });
    }
  }

  private static async logApiCall(log: TablesInsert<"api_logs">) {
    const supabase = createClient();

    try {
      await supabase.from("api_logs").insert({
        ...log,
        headers: log.headers || {},
        response_headers: log.response_headers || {},
      });
    } catch (err) {
      console.error(`Failed top log API call: ${err}`);
    }
  }
}
