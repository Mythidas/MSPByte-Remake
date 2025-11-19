"use client";

import { useQuery } from "convex/react";
import { api, Doc } from "@/lib/api";
import SearchBox from "@/components/SearchBox";
import { Building2 } from "lucide-react";
import { useManageSite } from "@/hooks/useManageSite";
import { useAuthReady } from "@/hooks/useAuthReady";

export function SiteSelector() {
    const { site: currentSite, setSite } = useManageSite();
    const { isLoading: authLoading, isAuthenticated } = useAuthReady();

    // Fetch all sites for the current tenant
    // Skip query if auth is still loading or user is not authenticated
    const sites = useQuery(
        api.helpers.orm.list,
        !authLoading && isAuthenticated ? {
            tableName: 'sites'
        } : 'skip'
    ) as Doc<'sites'>[] | undefined;

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

    // Transform sites into options format
    const options = sites ? [
        { label: 'No site selected', value: 'none' },
        ...sites.map((site) => ({
            label: site.name,
            value: site._id
        }))
    ] : [];

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
