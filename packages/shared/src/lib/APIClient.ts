import { createPrivelagedClient } from "@workspace/shared/lib/db/client";
import Debug from "@workspace/shared/lib/Debug";
import Encryption from "@workspace/shared/lib/Encryption";
import { APIResponse } from "@workspace/shared/types/api";
import { TablesInsert } from "@workspace/shared/types/database";

export default class APIClient {
  private static readonly SENSITIVE_HEADERS = [
    "authorization",
    "cookie",
    "set-cookie",
    "api-key",
    "x-api-key",
    "x-access-token",
    "client_secret",
    "secret",
  ];

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
          message: `HTTP ${response.status}: ${response.statusText}`,
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

  private static async sanitizeHeaders(
    headers: Record<string, string | string[]>
  ) {
    const result: Record<string, string> = {};
    for (const [key, val] of Object.entries(headers)) {
      if (this.SENSITIVE_HEADERS.includes(key.toLowerCase())) {
        result[key] = await Encryption.encrypt(
          typeof val === "string" ? val : val.join(",")
        );
      } else {
        result[key] = Array.isArray(val) ? val.join(",") : val;
      }
    }
    return result;
  }

  private static async logApiCall(log: TablesInsert<"api_logs">) {
    const supabase = createPrivelagedClient();

    try {
      await supabase.from("api_logs").insert({
        ...log,
        headers: await this.sanitizeHeaders(
          (log.headers || {}) as Record<string, string | string[]>
        ),
        response_headers: await this.sanitizeHeaders(
          (log.response_headers || {}) as Record<string, string | string[]>
        ),
      });
    } catch (err) {
      console.error(`Failed top log API call: ${err}`);
    }
  }
}
