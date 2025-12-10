"use client";

import { useAppStore } from "@/lib/stores/AppStore";
import { useMutation, useQuery } from "convex/react";
import { api, Doc } from "@/lib/api";
import { useEffect } from "react";
import { useAuthReady } from "./useAuthReady";
import { toast } from "sonner";
import { INTEGRATIONS } from "@workspace/shared/types/integrations/config";

export function useApp() {
  const { currentSite, currentMode, setSite, setMode } = useAppStore();

  return {
    site: currentSite,
    mode: currentMode,
    setSite,
    setMode,
  };
}

export function useFetchModes() {
  const { availableModes, setAvailableModes } = useAppStore();
  const { isLoading: authLoading, isAuthenticated } = useAuthReady();
  const validModes = ["microsoft-365", "msp-agent"];

  // Skip query if auth is loading or user is not authenticated
  const dataSources = useQuery(
    api.helpers.orm.list,
    !authLoading && isAuthenticated
      ? {
          tableName: "data_sources",
          index: {
            name: "by_primary",
            params: {
              isPrimary: true,
            },
          },
        }
      : "skip",
  ) as Doc<"data_sources">[];

  useEffect(() => {
    if (!dataSources) return;

    const filtered = dataSources
      .map((d) => d.integrationId)
      .filter((m) => validModes.includes(m));
    const modes = filtered.map((f) => INTEGRATIONS[f]);

    // Improved comparison: check if modes have actually changed
    const modesChanged =
      modes.length !== availableModes.length ||
      modes.some((mode, index) => mode.slug !== availableModes[index]?.slug);

    if (modesChanged) {
      setAvailableModes(modes);
    }
  }, [dataSources, availableModes, setAvailableModes]);

  return {
    modes: availableModes,
    isLoading: authLoading || (!dataSources && isAuthenticated),
  };
}

export function useManageMode() {
  const { currentMode, availableModes, setMode } = useAppStore();
  const updateMyMetadata = useMutation(api.users.mutate.updateMyMetadata);

  const setModeMutation = async (modeSlug: string | null) => {
    try {
      if (!modeSlug) {
        setMode(null);
        await updateMyMetadata({ currentMode: null });
      } else {
        const mode = availableModes.find((m) => m.slug === modeSlug);
        if (!mode || mode === currentMode) return;

        setMode(mode);
        await updateMyMetadata({ currentMode: mode.slug });
      }
    } catch (err) {
      console.error("Failed to update mode:", err);
      toast.error("Failed to update mode. Please try again.");
      // Revert local state on error
      if (currentMode) {
        setMode(currentMode);
      }
    }
  };

  return { mode: currentMode, modes: availableModes, setMode: setModeMutation };
}

export function useSyncAppFromUrl(siteSlug?: string, modeSlug?: string) {
  const { currentSite, currentMode, availableModes, setSite, setMode } =
    useAppStore();
  const { isLoading: authLoading, isAuthenticated } = useAuthReady();

  // Skip query if auth is loading, user is not authenticated, or no slug provided
  const site = useQuery(
    api.helpers.orm.get,
    !authLoading && isAuthenticated && siteSlug
      ? {
          tableName: "sites",
          index: { name: "by_slug", params: { slug: siteSlug } },
        }
      : "skip",
  );

  useEffect(() => {
    // URL takes precedence over stored state
    if (siteSlug && site && currentSite?.slug !== siteSlug) {
      setSite(site as Doc<"sites">);
    }

    if (modeSlug !== undefined && currentMode?.slug !== modeSlug) {
      if (modeSlug === "default") {
        setMode(null);
      } else {
        setMode(availableModes.find((m) => m?.slug === modeSlug) || null);
      }
    }
  }, [
    site,
    siteSlug,
    modeSlug,
    currentSite,
    currentMode,
    availableModes,
    setSite,
    setMode,
  ]);
}
