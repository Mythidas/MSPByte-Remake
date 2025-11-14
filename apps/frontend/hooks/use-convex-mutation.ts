"use client";

import { useMutation } from "convex/react";
import { api } from "@/lib/api";
import { Site } from "@/lib/types";
import { useSiteStore } from "@/stores/SiteStore";
import { useCallback } from "react";

/**
 * Hook to update site selection with Convex persistence
 */
export function usePersistSite() {
    const updateMetadata = useMutation(api.users.mutate.updateMyMetadata);
    const { setSite: setStoreSite } = useSiteStore();

    return useCallback(
        async (site: Site | null) => {
            // Update Zustand store immediately
            setStoreSite(site);

            // Persist to Convex
            if (site) {
                await updateMetadata({
                    metadata: {
                        currentSite: site._id,
                    },
                });
            }
        },
        [updateMetadata, setStoreSite]
    );
}
