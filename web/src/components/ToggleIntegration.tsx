"use client";

import { Tables } from "@workspace/shared/types/database";
import { Power } from "lucide-react";
import { deleteRows } from "@/lib/supabase/orm";
import { toast } from "sonner";
import { useState } from "react";
import { SubmitButton } from "@/components/SubmitButton";

type Props = {
  integration: Tables<"integrations">;
  dataSource?: Tables<"data_sources">;
};

export default function ToggleIntegration({ integration, dataSource }: Props) {
  const [isSaving, setIsSaving] = useState(false);

  const handleToggle = async () => {
    if (dataSource) {
      setIsSaving(true);

      const result = await deleteRows("data_sources", {
        filters: [["id", "eq", dataSource.id]],
      });

      if (result.error) {
        toast.error(`Failed to disable integration for ${integration.name}`);
      } else {
        dataSource = undefined;
        toast.info(`Disabled integration for ${integration.name}`);
      }

      window.location.reload();
      setIsSaving(false);
    }
  };

  if (!dataSource) return;

  return (
    <SubmitButton
      variant="destructive"
      onClick={handleToggle}
      pending={isSaving}
    >
      <Power className="w-4" /> Disable
    </SubmitButton>
  );
}
