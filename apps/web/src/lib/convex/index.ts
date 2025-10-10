/**
 * Type Re-Export Bridge for Convex
 *
 * This file re-exports Convex types from the @workspace/database package.
 * It exists to solve a Svelte 5 type resolution issue where complex types
 * from external packages aren't properly resolved.
 *
 * By re-exporting from within the src/ directory, SvelteKit's TypeScript
 * configuration can properly resolve all the deeply nested API types.
 */

// Re-export API and internal functions
export { api, internal } from '@workspace/database/convex/_generated/api';

// Re-export types
export type {
  Id,
  Doc,
  DataModel,
  TableNames
} from '@workspace/database/convex/_generated/dataModel';
