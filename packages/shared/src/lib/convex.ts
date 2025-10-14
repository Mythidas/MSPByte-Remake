import { ConvexClient } from "convex/browser";

/**
 * Convex client for server-side operations
 * Used to call Convex actions from the backend
 *
 * Lazy-loaded to ensure environment variables are available before initialization
 */
let _client: ConvexClient | null = null;

export const client = new Proxy({} as ConvexClient, {
  get(_target, prop) {
    if (!_client) {
      const CONVEX_URL = process.env.CONVEX_URL;
      if (!CONVEX_URL) {
        throw new Error("CONVEX_URL environment variable is not set");
      }
      _client = new ConvexClient(CONVEX_URL);
    }
    return (_client as any)[prop];
  },
});
