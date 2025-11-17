"use client";

import { useMutation } from "convex/react";
import { api, Doc } from "@/lib/api";
import { useAppStore } from "@/stores/AppStore";
import { useCallback } from "react";

type Site = Doc<"sites">;

/**
 * Hook to update site selection with Convex persistence
 */
export function usePersistSite() {
    const updateMetadata = useMutation(api.users.mutate.updateMyMetadata);
    const { setSite: setStoreSite } = useAppStore();

    return useCallback(
        async (site: Site | null) => {
            // Update Zustand store immediately
            setStoreSite(site);

            // Persist to Convex
            if (site) {
                await updateMetadata({
                    currentSite: site._id,
                });
            }
        },
        [updateMetadata, setStoreSite]
    );
}
