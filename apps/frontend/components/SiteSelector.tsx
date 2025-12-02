"use client";

import { useQuery } from "convex/react";
import { api, Doc } from "@/lib/api";
import SearchBox from "@/components/SearchBox";
import { Building2 } from "lucide-react";
import { useManageSite } from "@/hooks/useManageSite";
import { useAuthReady } from "@/hooks/useAuthReady";
import { useManageMode } from "@/hooks/useApp";
import { useEffect, useState } from "react";

export function SiteSelector() {
    const { site: currentSite, setSite } = useManageSite();
    const { mode } = useManageMode();
    const { isLoading: authLoading, isAuthenticated } = useAuthReady();
    const [options, setOptions] = useState<{ label: string, value: string }[]>([]);

    // Fetch all sites for the current tenant
    // Skip query if auth is still loading or user is not authenticated
    const sites = useQuery(
        api.helpers.orm.list,
        !authLoading && isAuthenticated ? {
            tableName: 'sites'
        } : 'skip'
    ) as Doc<'sites'>[] | undefined;
    const mappings = useQuery(
        api.helpers.orm.list,
        authLoading || !mode ? 'skip' : {
            tableName: 'data_source_to_site',
            index: {
                name: 'by_integration',
                params: {
                    integrationId: mode._id,
                }
            }
        }
    ) as Doc<'data_source_to_site'>[] | undefined;

    const handleSelect = async (value: string) => {
        if (value === 'none') {
            await setSite(null);
            return;
        }

        const selected = sites?.find((s) => s._id === value);
        if (selected) {
            await setSite(selected);
        }
    };

    useEffect(() => {
        if (!sites) return;

        const filteredSites = sites.filter((site) => {
            if (!mappings || !mode) return true;

            const exists = mappings.find((m) => m.siteId === site._id);
            return !!exists;
        });

        const opts = [
            { label: 'No site selected', value: 'none' },
            ...filteredSites.map((site) => ({
                label: site.name,
                value: site._id
            }))
        ];

        setOptions(opts);
    }, [sites, mode, mappings])

    return (
        <div className="w-96">
            <SearchBox
                className="!bg-card/50 rounded shadow !h-9 !border-border !ring-[0px] !ring-none"
                placeholder={currentSite?.name ?? "Select a site"}
                defaultValue={currentSite?._id ?? 'none'}
                onSelect={handleSelect}
                options={options}
                loading={authLoading || (!sites && isAuthenticated)}
                lead={<Building2 className="w-4 h-4 text-muted-foreground" />}
                leadClass="!top-2.5 !left-3.5"
            />
        </div>
    );
}
