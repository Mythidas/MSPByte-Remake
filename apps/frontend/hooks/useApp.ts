"use client";

import { useAppStore } from "@/stores/AppStore";
import { useMutation, useQuery } from "convex/react";
import { api, Doc } from "@/lib/api";
import { useEffect } from "react";

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
    const validModes = ['microsoft-365', 'msp-agent'];

    const integrations = useQuery(api.integrations.query.listActiveWithDataSource, {});

    useEffect(() => {
        const modes = integrations?.filter((i) => i.dataSourceStatus !== 'inactive' && validModes.includes(i.slug)) || [];
        if (JSON.stringify(availableModes) === JSON.stringify(modes)) {
            return;
        }

        setAvailableModes(modes);
    }, [integrations])
}

export function useManageMode() {
    const { currentMode, availableModes, setMode } = useAppStore();
    const updateMyMetadata = useMutation(api.users.mutate.updateMyMetadata);

    const setModeMutatation = async (modeSlug: string | null) => {
        if (!modeSlug) {
            setMode(null);
            try {
                await updateMyMetadata({
                    currentMode: null
                });
            } catch (err) {
                console.log(err)
            }
        } else {
            const mode = availableModes.find((m) => m.slug === modeSlug);
            if (!mode || mode === currentMode) return;

            setMode(mode);
            try {
                await updateMyMetadata({ currentMode: mode.slug });
            } catch (err) {
                console.log(err);
            }
        }
    }

    return { mode: currentMode, modes: availableModes, setMode: setModeMutatation };
}

export function useSyncAppFromUrl(siteSlug?: string, modeSlug?: string) {
    const { currentSite, currentMode, availableModes, setSite, setMode } = useAppStore();

    const site = useQuery(
        api.helpers.orm.get,
        { tableName: 'sites', index: { name: 'by_slug', params: { slug: siteSlug || '' } } }
    );

    useEffect(() => {
        // URL takes precedence over stored state
        if (siteSlug && site && currentSite?.slug !== siteSlug) {
            setSite(site as Doc<'sites'>);
        }

        if (modeSlug !== undefined && currentMode?.slug !== modeSlug) {
            if (modeSlug === 'default') {
                setMode(null);
            } else {
                setMode(availableModes.find((m) => m?.slug === modeSlug) || null);
            }
        }
    }, [site, siteSlug, modeSlug, currentSite, currentMode, availableModes, setSite, setMode]);
}
