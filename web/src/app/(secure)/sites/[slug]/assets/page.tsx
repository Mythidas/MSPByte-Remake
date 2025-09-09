"use client";

import { LazyTabContent } from "@/components/LazyTabContent";
import Loader from "@/components/Loader";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSiteStore } from "@/lib/stores/site-store";
import SophosPartnerAssets from "@/modules/integrations/sophos-partner/components/SophosPartnerAssets";
import { useState } from "react";

export default function Page() {
  const [tab, setTab] = useState("sophos-partner");
  const { site } = useSiteStore();
  if (!site) return <Loader />;

  return (
    <div className="flex flex-col relative">
      <Tabs defaultValue="sophos-partner" onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="sophos-partner">Sophos Partner</TabsTrigger>
        </TabsList>

        <LazyTabContent value="sophos-partner" tab={tab}>
          <SophosPartnerAssets site={site} />
        </LazyTabContent>
      </Tabs>
    </div>
  );
}
