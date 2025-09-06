import AutoTaskPage from "@/components/integrations/pages/AutoTaskPage";
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
};

export default INTEGRATION_PAGES;
