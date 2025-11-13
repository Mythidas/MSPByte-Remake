"use client";

import { useWardStore } from "@/stores/ward-store";
import { useQuery } from "convex/react";
import { api } from "@/lib/api";
import { useEffect } from "react";
import { buildModeConfig } from "@/lib/mode-config";

/**
 * Hook to access current ward (site) and mode
 */
export function useWard() {
    const { currentSite, currentMode, setSite, setMode } = useWardStore();

    return {
        site: currentSite,
        mode: currentMode,
        setSite,
        setMode,
    };
}

/**
 * Hook to load and sync available sites
 */
export function useSites() {
    const { sites, setSites } = useWardStore();

    const sitesList = useQuery(api.sites.query.list);

    useEffect(() => {
        if (sitesList) {
            setSites(sitesList);
        }
    }, [sitesList, setSites]);

    return sites;
}

/**
 * Hook to get available modes for the current site
 */
export function useAvailableModes() {
    const { currentSite, availableModes, setAvailableModes } = useWardStore();

    // Get site with linked integrations
    const siteWithIntegrations = useQuery(
        api.sites.query.getSiteWithIntegrationsView,
        currentSite ? { id: currentSite._id } : "skip"
    );

    useEffect(() => {
        if (!siteWithIntegrations?.linkedIntegrations) return;

        // Fetch full integration details to build mode configs
        const modes = siteWithIntegrations.linkedIntegrations.map((linked) => {
            // We need to query each integration for full details
            // For now, we'll create a basic config from the linked data
            return buildModeConfig({
                _id: linked.id,
                slug: linked.slug,
                name: linked.name,
                supportedTypes: [], // TODO: Need to fetch full integration data
                color: undefined,
            });
        });

        setAvailableModes(modes);
    }, [siteWithIntegrations, setAvailableModes]);

    return availableModes;
}

/**
 * Hook to sync ward state from URL parameters
 * Should be called in layout components
 */
export function useSyncWardFromUrl(siteSlug?: string, modeSlug?: string) {
    const { currentSite, currentMode, setSite, setMode } = useWardStore();

    const site = useQuery(
        api.sites.query.getBySlug,
        siteSlug && siteSlug !== currentSite?.slug ? { slug: siteSlug } : "skip"
    );

    useEffect(() => {
        // URL takes precedence over stored state
        if (siteSlug && site && currentSite?.slug !== siteSlug) {
            setSite(site);
        }

        if (modeSlug !== undefined && currentMode !== modeSlug) {
            setMode(modeSlug);
        }
    }, [site, siteSlug, modeSlug, currentSite, currentMode, setSite, setMode]);
}
