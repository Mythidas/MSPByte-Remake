import Microsoft365ConnectStep from "@/modules/integrations/microsoft-365/Microsoft365ConnectStep";
import { Tables } from "@workspace/shared/types/database";
import { ReactNode } from "react";

type RenderConfig = {
  integration: Tables<"integrations">;
};

export type IntegrationConfig = {
  fullDescription: string;
  steps: {
    name: string;
    description: string;
    render: ({ ...props }: RenderConfig) => ReactNode;
  }[];
};

const INTEGRATION_PAGES: Record<string, IntegrationConfig> = {
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
