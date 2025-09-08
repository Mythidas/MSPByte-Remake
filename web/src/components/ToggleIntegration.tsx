import { Tables } from "@workspace/shared/types/database";
import { Button } from "@/components/ui/button";
import { Power } from "lucide-react";
import { deleteRows } from "@/lib/supabase/orm";
import { toast } from "sonner";

type Props = {
  integration: Tables<"integrations">;
  dataSource?: Tables<"data_sources">;
};

export default function ToggleIntegration({ integration, dataSource }: Props) {
  const handleToggle = async () => {
    if (dataSource) {
      const result = await deleteRows("data_sources", {
        filters: [["id", "eq", dataSource.id]],
      });

      dataSource = undefined;
      toast.info(`Disabled integration for ${integration.name}`);
    }
  };

  if (!dataSource) return;

  return (
    <Button variant="destructive" onClick={handleToggle}>
      <Power className="w-4" /> Disable
    </Button>
  );
}
