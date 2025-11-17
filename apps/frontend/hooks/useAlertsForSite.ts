"use client";

import { useQuery } from "convex/react";
import { api, Doc } from "@/lib/api";

/**
 * Fetches alerts for a specific site, optionally filtered by integration
 * @param siteId - The site ID to filter alerts by
 * @param integrationSlug - Optional integration slug to further filter alerts
 * @returns Array of entity alerts or undefined while loading
 */
export function useAlertsForSite(
  siteId: string | null,
  integrationSlug?: string
) {
  return useQuery(
    api.helpers.orm.list,
    siteId
      ? {
          tableName: "entity_alerts",
          index: {
            name: "by_site",
            params: { siteId },
          },
          filters: integrationSlug ? { integrationSlug } : undefined,
        }
      : "skip"
  ) as Doc<"entity_alerts">[] | undefined;
}
