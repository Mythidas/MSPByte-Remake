"use client";

import { useParams, useRouter } from "next/navigation";
import { useFetchModes, useManageMode, useSyncAppFromUrl } from "@/hooks/useApp";
import { getNavigationForMode } from "@/config/navigation";
import SearchBox from "./SearchBox";
import { NavItem } from "./SideNavbar/NavItem";
import { NavGroup } from "./SideNavbar/NavGroup";

export default function SideNavbar() {
    const params = useParams();
    const modeSlug = params.mode as string | undefined;
    const siteSlug = params.siteSlug as string | undefined;

    useSyncAppFromUrl(siteSlug, modeSlug)
    useFetchModes()

    const { mode } = useManageMode();
    const navConfig = getNavigationForMode(mode?.slug || null);

    return (
        <div className="flex flex-col w-52 gap-2 pt-2">
            <ModesSelector />
            <nav className="bg-card/60 rounded shadow flex flex-col p-2 gap-1 overflow-y-auto h-full border">
                {navConfig.items.map((item, idx) => {
                    if (item.children && item.children.length > 0) {
                        return <NavGroup key={idx} item={item} />;
                    }
                    return <NavItem key={idx} item={item} />;
                })}
            </nav>
        </div>
    )
}

function ModesSelector() {
    const { mode, modes, setMode } = useManageMode();
    const router = useRouter();

    const handleSelect = async (v: string) => {
        const modeSlug = v === 'default' ? 'default' : v;

        if (v === 'default') {
            await setMode(null);
        } else {
            const selected = modes.find((m) => m.slug === v);
            if (selected) await setMode(selected.slug);
        }

        // Navigate to the mode's default page
        router.push(`/secure/${modeSlug}`);
    }

    return <SearchBox
        className="!bg-card/60 rounded shadow text-center !h-12 !border-border !ring-[0px] !ring-none !text-base"
        placeholder="Select Mode"
        defaultValue={!!mode ? mode.slug : 'default'}
        onSelect={handleSelect}
        options={[
            { label: 'Default', value: 'default' },
            ...modes.map((i) => ({ label: i.name, value: i.slug }))
        ]}
    />
}
