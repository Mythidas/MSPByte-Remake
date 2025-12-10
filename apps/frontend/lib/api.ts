/**
 * Client-safe Convex API re-export
 *
 * This file re-exports the Convex API from the .js file (not .d.ts)
 * to avoid Next.js trying to resolve server-only type imports during build.
 */

// Import from .js file to avoid server-only type resolution issues
export { api, internal } from "@workspace/database/convex/_generated/api.js";

// Re-export types from dataModel (safe for client)
export type {
  Id,
  Doc,
  DataModel,
  TableNames,
} from "@workspace/database/convex/_generated/dataModel";
