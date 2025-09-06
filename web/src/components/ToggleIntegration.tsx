import { Tables } from "@workspace/shared/types/database";
import { Button } from "@/components/ui/button";
import { Power } from "lucide-react";

type Props = {
  integration: Tables<"integrations">;
  dataSource?: Tables<"data_sources">;
};

export default function ToggleIntegration({ integration, dataSource }: Props) {
  if (!dataSource) {
    return (
      <Button>
        <Power className="w-4" /> Enable
      </Button>
    );
  }

  return (
    <Button variant="destructive">
      <Power className="w-4" /> Disable
    </Button>
  );
}
