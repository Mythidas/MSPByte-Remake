import AutoTaskPage from "@/components/integrations/pages/AutoTaskPage";
import SophosPartnerPage from "@/components/integrations/pages/SophosPartnerPage";
import { Tables } from "@workspace/shared/types/database";
import { ReactNode } from "react";

type Pages = Record<
  string,
  (
    integration: Tables<"integrations">,
    dataSource?: Tables<"data_sources">
  ) => ReactNode
>;

const INTEGRATION_PAGES: Pages = {
  autotask: (integration, dataSource) => (
    <AutoTaskPage integration={integration} dataSource={dataSource} />
  ),
  "sophos-partner": (integration, dataSource) => (
    <SophosPartnerPage integration={integration} dataSource={dataSource} />
  ),
};

export default INTEGRATION_PAGES;
