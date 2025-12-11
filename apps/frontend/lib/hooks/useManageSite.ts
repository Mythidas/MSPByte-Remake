import { useMutation } from "convex/react";
import { api, Doc } from "@/lib/api";
import { useAppStore } from "@/lib/stores/AppStore";
import { useCallback } from "react";
import { toast } from "sonner";

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
      const previousSite = currentSite;

      try {
        // Update Zustand store immediately for instant UI feedback
        setStoreSite(site);

        // Persist to user metadata (cross-device + source of truth)
        await updateMyMetadata({
          currentSite: site?._id ?? null,
        });
      } catch (error) {
        console.error("Failed to persist site selection:", error);
        toast.error("Failed to save site selection. Please try again.");

        // Revert to previous site on error
        setStoreSite(previousSite);
      }
    },
    [currentSite, updateMyMetadata, setStoreSite],
  );

  return {
    site: currentSite,
    setSite,
  };
}
