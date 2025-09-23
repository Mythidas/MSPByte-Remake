import AutoTaskConnectStep from "@/modules/integrations/autotask/AutoTaskConnectStep";
import AutoTaskMapSitesStep from "@/modules/integrations/autotask/AutoTaskMapSitesStep";
import Microsoft365ConnectStep from "@/modules/integrations/microsoft-365/Microsoft365ConnectStep";
import { Tables } from "@workspace/shared/types/database";
import { ReactNode } from "react";

type RenderConfig = {
  integration: Tables<"integrations">;
};

export type IntegrationConfig = {
  fullDescription: ReactNode;
  steps: {
    name: string;
    description: string;
    render: ({ ...props }: RenderConfig) => ReactNode;
  }[];
};

const INTEGRATION_PAGES: Record<string, IntegrationConfig> = {
  autotask: {
    fullDescription: "",
    steps: [
      {
        name: "Connect",
        description: "Link AutoTask instance through API User Credentials",
        render: (props) => <AutoTaskConnectStep {...props} />,
      },
      {
        name: "Map Sites",
        description: "Map Sites sycned from AutoTask instance",
        render: (props) => <AutoTaskMapSitesStep {...props} />,
      },
    ],
  },
  "microsoft-365": {
    fullDescription: "Microsoft integration provides blah blah blah",
    steps: [
      {
        name: "Connect",
        description: "Create M365 Connections and Link Sites",
        render: (props) => <Microsoft365ConnectStep {...props} />,
      },
    ],
  },
};

export default INTEGRATION_PAGES;
