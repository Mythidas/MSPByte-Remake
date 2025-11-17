import { useMutation } from "convex/react";
import { api, Doc } from "@/lib/api";
import { useAppStore } from "@/stores/AppStore";
import { useCallback } from "react";

type Site = Doc<"sites">;

/**
 * Hook to manage site selection with persistence
 * Similar to useManageMode but for site state
 */
export function useManageSite() {
    const { currentSite, setSite: setStoreSite } = useAppStore();
    const updateMyMetadata = useMutation(api.users.mutate.updateMyMetadata);

    const setSite = useCallback(
        async (site: Site | null) => {
            // Update Zustand store immediately for instant UI feedback
            setStoreSite(site);

            // Persist to user metadata (cross-device + source of truth)
            try {
                await updateMyMetadata({
                    currentSite: site?._id ?? null,
                });
            } catch (error) {
                console.error("Failed to persist site selection:", error);
                // Note: UI already updated, so user sees change even if persistence fails
                // Could add toast notification here if desired
            }
        },
        [updateMyMetadata, setStoreSite]
    );

    return {
        site: currentSite,
        setSite,
    };
}
