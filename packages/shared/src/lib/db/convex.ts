import { ConvexClient } from "convex/browser";

/**
 * Convex client for server-side operations
 * Used to call Convex actions from the backend
 */
export const client = new ConvexClient(process.env.CONVEX_URL!);
