"use client";

import { Tables } from "@workspace/shared/types/database";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SophosPartnerMappingTab from "@/modules/integrations/sophos-partner/components/SophosPartnerMappingTab";
import { LazyTabContent } from "@/components/LazyTabContent";
import SophosPartnerConfigTab from "@/modules/integrations/sophos-partner/components/SophosPartnerConfigTab";
import { useState } from "react";

type Props = {
  integration: Tables<"integrations">;
  dataSource?: Tables<"data_sources">;
};

export default function SophosPartnerPage({ integration, dataSource }: Props) {
  const [tab, setTab] = useState("1");

  return (
    <div className="grid gap-4">
      <span className="text-2xl font-semibold">Instructions</span>
      <div className="grid gap-2">
        <p className="flex gap-2">
          <Badge variant="default">Step 1</Badge>
          <span>
            Before you get started, please make sure that you have an active
            SophosPartner account.
          </span>
        </p>
        <p className="flex gap-2">
          <Badge variant="default">Step 2</Badge>
          <span>
            Log into SophosPartner and create a Client ID and Client Secret
          </span>
        </p>
        <p className="flex gap-2">
          <Badge variant="default">Step 3</Badge>
          <span>Link to sites in MSPByte, synced from your PSA</span>
        </p>
      </div>
      <Tabs defaultValue="1" onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="1">
            <Badge className="rounded-full bg-primary w-6 h-6">1</Badge>
            Connect
          </TabsTrigger>
          <TabsTrigger value="2" disabled={!dataSource}>
            <Badge className="rounded-full bg-primary w-6 h-6">2</Badge>
            Map sites
          </TabsTrigger>
        </TabsList>

        <LazyTabContent value="1" tab={tab}>
          <SophosPartnerConfigTab
            integration={integration}
            dataSource={dataSource}
          />
        </LazyTabContent>

        <LazyTabContent value="2" tab={tab}>
          <SophosPartnerMappingTab
            integration={integration}
            dataSource={dataSource!}
          />
        </LazyTabContent>
      </Tabs>
    </div>
  );
}
