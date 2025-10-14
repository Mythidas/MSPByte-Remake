import { v, Validator } from "convex/values";

/**
 * Make a required validator optional and nullable.
 */
export function nullable<T>(
  type: Validator<T, "required", any>
): Validator<T | null | undefined, "optional", any> {
  return v.optional(v.union(type, v.null()));
}

export function cleanUpdates<T extends Record<string, any>>(obj: T) {
  const cleaned: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    cleaned[k] = v === null ? undefined : v;
  }
  return cleaned;
}
