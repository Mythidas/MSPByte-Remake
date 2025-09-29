"use client";

import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@workspace/ui/components/alert-dialog";
import { toast } from "sonner";
import { LoaderIcon, AlertTriangleIcon } from "lucide-react";
import { disableIntegration } from "./actions/disable-integration";
import { SubmitButton } from "@workspace/ui/components/SubmitButton";

type Props = {
  integrationId: string;
  integrationName: string;
  dataSourcesCount: number;
};

export default function DisableIntegrationButton({
  integrationId,
  integrationName,
  dataSourcesCount,
}: Props) {
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isDisabling, setIsDisabling] = useState(false);

  const handleDisable = async () => {
    setIsDisabling(true);
    try {
      const result = await disableIntegration(integrationId);

      if (result.success) {
        toast.success(
          `Successfully disabled ${result.disabledCount} data sources for ${integrationName}. Data will be permanently deleted in 7 days.`
        );
        setShowConfirmDialog(false);
        // The page will be revalidated by the server action
      } else {
        toast.error(result.error || "Failed to disable integration");
      }
    } catch (error) {
      toast.error("An unexpected error occurred");
      console.error("Error disabling integration:", error);
    } finally {
      setIsDisabling(false);
    }
  };

  // Don't show button if no data sources exist
  if (dataSourcesCount === 0) {
    return null;
  }

  return (
    <>
      <SubmitButton
        variant="destructive"
        onClick={() => setShowConfirmDialog(true)}
        pending={isDisabling}
      >
        Disable
      </SubmitButton>

      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangleIcon className="w-5 h-5 text-destructive" />
              Disable {integrationName} Integration
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                This action will disable <strong>{dataSourcesCount}</strong>{" "}
                data source{dataSourcesCount > 1 ? "s" : ""}
                connected to this integration.
              </p>
              <p>
                <strong>What happens when you disable:</strong>
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>All data sources will be marked as disabled</li>
                <li>Data synchronization will stop immediately</li>
                <li>Existing data will remain accessible for 7 days</li>
                <li>After 7 days, all data will be permanently deleted</li>
              </ul>
              <p className="font-semibold text-destructive">
                This action cannot be undone after the 7-day grace period.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDisabling}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDisable}
              disabled={isDisabling}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isDisabling ? (
                <>
                  <LoaderIcon className="w-4 h-4 animate-spin mr-2" />
                  Disabling...
                </>
              ) : (
                `Yes, Disable ${dataSourcesCount} Data Source${dataSourcesCount > 1 ? "s" : ""}`
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
