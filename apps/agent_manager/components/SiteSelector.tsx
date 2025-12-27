"use client";

import { useQuery } from "convex/react";
import { api, Doc } from "@/lib/api";
import SearchBox from "@/components/SearchBox";
import { Building2 } from "lucide-react";
import { useAppStore } from "@/lib/stores/AppStore";
import { useEffect, useState } from "react";

export function SiteSelector() {
  const { currentSite, setSite } = useAppStore();
  const [options, setOptions] = useState<{ label: string; value: string }[]>(
    [],
  );

  // Fetch all sites using *_s variant with secret
  const sites = useQuery(api.helpers.orm.list_s, {
    secret: process.env.NEXT_PUBLIC_CONVEX_SECRET!,
    tableName: "sites",
  }) as Doc<"sites">[] | undefined;

  // Auto-select first site on mount if no site is selected
  useEffect(() => {
    if (sites && sites.length > 0 && !currentSite) {
      setSite(sites[0]);
    }
  }, [sites, currentSite, setSite]);

  useEffect(() => {
    if (!sites) return;

    const opts = [
      { label: "No site selected", value: "none" },
      ...sites.map((site) => ({
        label: site.name,
        value: site._id,
      })),
    ];

    setOptions(opts);
  }, [sites]);

  const handleSelect = (value: string) => {
    if (value === "none") {
      setSite(null);
      return;
    }

    const selected = sites?.find((s) => s._id === value);
    if (selected) {
      setSite(selected);
    }
  };

  return (
    <div className="w-96">
      <SearchBox
        className="!bg-card/50 rounded shadow !h-9 !border-border !ring-[0px] !ring-none"
        placeholder={currentSite?.name ?? "Select a site"}
        defaultValue={currentSite?._id ?? "none"}
        onSelect={handleSelect}
        options={options}
        loading={!sites}
        lead={<Building2 className="w-4 h-4 text-muted-foreground" />}
        leadClass="!top-2.5 !left-3.5"
      />
    </div>
  );
}
